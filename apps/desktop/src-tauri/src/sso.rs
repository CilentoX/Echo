//! SSO loopback listener.
//!
//! Opens a one-shot HTTP server on `127.0.0.1:<random port>` that captures the
//! `loginToken` query param Synapse redirects back after the Google OIDC flow:
//! `http://127.0.0.1:<port>/callback?loginToken=...`.
//!
//! Two Tauri commands wrap this module (see `lib.rs`):
//! - `begin_sso_listener() -> u16`: starts the listener and returns the port;
//! - `finish_sso_listener(port) -> String`: resolves with the captured
//!   `loginToken`, or rejects after 5 minutes / if the listener was consumed.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use http_body_util::Full;
use hyper::body::{Bytes, Incoming};
use hyper::header::CONTENT_TYPE;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use tokio::net::TcpListener;
use tokio::sync::mpsc;

/// How long the listener waits for the browser round-trip (5 minutes).
const SSO_TIMEOUT: Duration = Duration::from_secs(5 * 60);

const CALLBACK_HTML: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">\
<title>Eco</title></head><body style=\"background:#0D1017;color:#E9EDF2;font-family:sans-serif;\
display:grid;place-items:center;height:100vh;margin:0\">\
<p>Login conclu\u{ed}do. Voc\u{ea} j\u{e1} pode voltar ao Eco.</p></body></html>";

const MISSING_TOKEN_HTML: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">\
<title>Eco</title></head><body style=\"background:#0D1017;color:#F87171;font-family:sans-serif;\
display:grid;place-items:center;height:100vh;margin:0\">\
<p>Token de login ausente no retorno.</p></body></html>";

/// Port -> receiver of the captured loginToken (one-shot, removed on read).
static LISTENERS: LazyLock<Mutex<HashMap<u16, mpsc::Receiver<String>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Binds `127.0.0.1:0` (SO assigns the port), serves until the token arrives
/// or the 5-minute timeout elapses, and registers the token receiver.
pub async fn begin_sso_listener() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("falha ao abrir listener SSO: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("falha ao obter porta do listener SSO: {e}"))?
        .port();

    let (tx, rx) = mpsc::channel::<String>(1);
    let previous = LISTENERS
        .lock()
        .map_err(|_| "mutex do listener SSO envenenado".to_string())?
        .insert(port, rx);
    if previous.is_some() {
        return Err("porta do listener SSO em conflito".to_string());
    }

    tokio::spawn(accept_loop(listener, tx));
    Ok(port)
}

/// Consumes the listener registered for `port` and resolves with the
/// `loginToken`; rejects on timeout or if the listener no longer exists.
pub async fn finish_sso_listener(port: u16) -> Result<String, String> {
    let mut rx = LISTENERS
        .lock()
        .map_err(|_| "mutex do listener SSO envenenado".to_string())?
        .remove(&port)
        .ok_or_else(|| "listener SSO não encontrado ou já consumido".to_string())?;

    match tokio::time::timeout(SSO_TIMEOUT, rx.recv()).await {
        Ok(Some(token)) => Ok(token),
        Ok(None) => Err("listener SSO cancelado antes de receber o token".to_string()),
        Err(_) => Err("tempo esgotado aguardando o login SSO".to_string()),
    }
}

/// Accepts connections until the 5-minute deadline, answering each request
/// with a small HTML page; the `loginToken` (when present) is forwarded once.
async fn accept_loop(listener: TcpListener, tx: mpsc::Sender<String>) {
    let deadline = tokio::time::Instant::now() + SSO_TIMEOUT;
    loop {
        let (stream, _) = match tokio::time::timeout_at(deadline, listener.accept()).await {
            Ok(Ok(conn)) => conn,
            // deadline elapsed or accept failed: stop listening
            _ => break,
        };

        let tx = tx.clone();
        tokio::spawn(async move {
            let service = service_fn(move |req: Request<Incoming>| {
                let tx = tx.clone();
                async move {
                    let token = extract_login_token(req.uri().query());
                    let (status, body) = match token {
                        Some(_) => (StatusCode::OK, CALLBACK_HTML),
                        None => (StatusCode::BAD_REQUEST, MISSING_TOKEN_HTML),
                    };
                    if let Some(token) = token {
                        // full if the receiver was already consumed: ignore
                        let _ = tx.send(token).await;
                    }
                    Response::builder()
                        .status(status)
                        .header(CONTENT_TYPE, "text/html; charset=utf-8")
                        .body(Full::new(Bytes::from(body)))
                        .map_err(|e| {
                            std::io::Error::other(format!("falha ao montar resposta SSO: {e}"))
                        })
                }
            });

            let _ = hyper::server::conn::http1::Builder::new()
                .serve_connection(TokioIo::new(stream), service)
                .await;
        });
    }
}

/// Extracts the `loginToken` query param value (first occurrence), percent-decoded.
fn extract_login_token(query: Option<&str>) -> Option<String> {
    query?
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .find(|(key, _)| *key == "loginToken")
        .map(|(_, value)| percent_decode(value))
}

/// Minimal percent-decoding for query param values (`%XX` sequences only).
fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
            if let Some(byte) = hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
                decoded.push(byte);
                i += 3;
                continue;
            }
        }
        decoded.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[test]
    fn extract_login_token_reads_query_param() {
        assert_eq!(
            extract_login_token(Some("loginToken=abc123")),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn extract_login_token_ignores_other_params_and_percent_decodes() {
        assert_eq!(
            extract_login_token(Some("foo=1&loginToken=abc%2Ddef")),
            Some("abc-def".to_string())
        );
        assert_eq!(extract_login_token(Some("other=1")), None);
        assert_eq!(extract_login_token(None), None);
    }

    #[tokio::test]
    async fn captures_login_token_via_real_loopback_request() {
        let port = begin_sso_listener().await.expect("listener deve subir");
        let pending_token = finish_sso_listener(port);

        // Simulates the Synapse redirect hitting the callback.
        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
            .await
            .expect("conexão ao listener");
        stream
            .write_all(
                b"GET /callback?loginToken=LT-test-1 HTTP/1.1\r\n\
                  Host: 127.0.0.1\r\nConnection: close\r\n\r\n",
            )
            .await
            .expect("request escrito");
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw).await.expect("resposta lida");

        let response = String::from_utf8_lossy(&raw);
        assert!(response.starts_with("HTTP/1.1 200 OK"), "resposta: {response}");
        assert!(response.contains("voltar ao Eco"), "resposta: {response}");

        assert_eq!(pending_token.await.expect("token capturado"), "LT-test-1");
    }

    #[tokio::test]
    async fn missing_token_query_returns_bad_request() {
        let port = begin_sso_listener().await.expect("listener deve subir");

        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
            .await
            .expect("conexão ao listener");
        stream
            .write_all(b"GET /callback?other=1 HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
            .await
            .expect("request escrito");
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw).await.expect("resposta lida");

        let response = String::from_utf8_lossy(&raw);
        assert!(response.starts_with("HTTP/1.1 400"), "resposta: {response}");
    }

    #[tokio::test]
    async fn finish_fails_for_port_without_listener() {
        // Port 1 can never come from an ephemeral `:0` bind.
        let err = finish_sso_listener(1).await.expect_err("deve falhar");
        assert!(err.contains("não encontrado"), "erro: {err}");
    }
}
