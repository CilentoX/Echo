//! SSO loopback listener.
//!
//! Opens a one-shot HTTP server on `127.0.0.1:1421` that captures the
//! `loginToken` query param Synapse redirects back after the Google OIDC flow:
//! `http://127.0.0.1:1421/callback?loginToken=...`.
//!
//! Two Tauri commands wrap this module (see `lib.rs`):
//! - `begin_sso_listener() -> u16`: starts the listener and returns the port;
//! - `finish_sso_listener(port) -> String`: resolves with the captured
//!   `loginToken`, or rejects after 5 minutes / if the listener was consumed.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio::sync::mpsc;

/// How long the listener waits for the browser round-trip (5 minutes).
const SSO_TIMEOUT: Duration = Duration::from_secs(5 * 60);

/// Fixed loopback port used for the SSO callback. Must match the
/// `redirect_uri` registered on Synapse so the browser round-trip reaches
/// this listener after Google authentication.
///
/// This MUST match the redirect_uris in homeserver.template (port 1421).
const SSO_PORT: u16 = 1421;

const CALLBACK_HTML: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">\
<title>Echo</title></head><body style=\"background:#0D1017;color:#E9EDF2;font-family:sans-serif;\
display:grid;place-items:center;height:100vh;margin:0\">\
<p>Login conclu\u{ed}do. Voc\u{ea} j\u{a} pode voltar ao Echo.</p></body></html>";

const MISSING_TOKEN_HTML: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">\
<title>Echo</title></head><body style=\"background:#0D1017;color:#F87171;font-family:sans-serif;\
display:grid;place-items:center;height:100vh;margin:0\">\
<p>Token de login ausente no retorno.</p></body></html>";

fn http_response(status: &str, body: &str) -> Vec<u8> {
    format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        body.len(),
        body
    )
    .into_bytes()
}

/// Port -> receiver of the captured loginToken (one-shot, removed on read).
static LISTENERS: LazyLock<Mutex<HashMap<u16, mpsc::Receiver<String>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub async fn begin_sso_listener() -> Result<u16, String> {
    eprintln!("[SSO] begin_sso_listener called, attempting to bind to port {}", SSO_PORT);

    let (tx, rx) = mpsc::channel::<String>(1);

    let previous = LISTENERS
        .lock()
        .map_err(|_| "mutex do listener SSO envenenado".to_string())?
        .insert(SSO_PORT, rx);
    if previous.is_some() {
        return Err("porta do listener SSO em conflito".to_string());
    }

    let addr = format!("127.0.0.1:{SSO_PORT}");
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("falha ao bindar listener SSO na porta {SSO_PORT}: {e}"))?;

    eprintln!("[SSO] Listener started successfully on port {SSO_PORT} (IPv4 127.0.0.1)");

    // Spawn the accept loop in the background
    tokio::spawn(async move {
        accept_loop(listener, tx).await;
    });

    Ok(SSO_PORT)
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
        Ok(Some(token)) => {
            eprintln!("[SSO] finish_sso_listener: token received successfully");
            Ok(token)
        }
        Ok(None) => {
            eprintln!("[SSO] finish_sso_listener: channel closed without token");
            Err("listener SSO cancelado antes de receber o token".to_string())
        }
        Err(_) => {
            eprintln!("[SSO] finish_sso_listener: timeout waiting for token");
            Err("tempo esgotado aguardando o login SSO".to_string())
        }
    }
}

/// Accept loop: accepts connections, spawns a task to handle each one.
async fn accept_loop(listener: TcpListener, tx: mpsc::Sender<String>) {
    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                eprintln!("[SSO] accepted connection from {}", addr);
                let tx = tx.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream, tx).await {
                        eprintln!("[SSO] connection error from {}: {:?}", addr, e);
                    }
                });
            }
            Err(e) => {
                eprintln!("[SSO] accept error: {:?}", e);
                break;
            }
        }
    }
}

/// Handles a single HTTP connection: reads the request, extracts loginToken,
/// sends the token via channel, and sends an HTML response back to the browser.
async fn handle_connection(
    mut stream: tokio::net::TcpStream,
    tx: mpsc::Sender<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Read until we find the end of HTTP headers (\r\n\r\n)
    let mut buf = Vec::with_capacity(4096);
    let mut header_end: Option<usize> = None;

    loop {
        let mut chunk = [0u8; 512];
        let n = stream.readable().await;
        let _ = n; // ensure readable
        let n = stream.try_read(&mut chunk)?;
        if n == 0 {
            break; // connection closed without sending anything
        }
        buf.extend_from_slice(&chunk[..n]);

        if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            header_end = Some(pos + 4);
            break;
        }

        if buf.len() > 8192 {
            break; // too large, give up
        }
    }

    let header_end = match header_end {
        Some(p) => p,
        None => {
            // No complete headers received; send 400 and close
            let res = http_response("400 Bad Request", MISSING_TOKEN_HTML);
            let _ = stream.write_all(&res).await;
            return Ok(());
        }
    };

    // Parse the request line to get the path and query
    let header_str = String::from_utf8_lossy(&buf[..header_end]);
    let first_line = header_str.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();

    let path_and_query = parts.get(1).copied().unwrap_or("");
    let query = path_and_query.split_once('?').map(|(_, q)| q);

    eprintln!("[SSO] Request: {} {}", parts.get(0).copied().unwrap_or("?"), path_and_query);
    eprintln!("[SSO] Query: {:?}", query);

    // Extract loginToken from query string
    let token = extract_login_token(query);

    let (status, body) = match token {
        Some(ref t) => {
            eprintln!("[SSO] Token extracted: {}", t);
            // Send token to the waiting finish_sso_listener
            match tx.try_send(t.clone()) {
                Ok(()) => eprintln!("[SSO] Token sent to finish_sso_listener channel"),
                Err(e) => eprintln!("[SSO] Failed to send token to channel: {:?}", e),
            }
            ("200 OK", CALLBACK_HTML)
        }
        None => {
            eprintln!("[SSO] No loginToken in query");
            ("400 Bad Request", MISSING_TOKEN_HTML)
        }
    };

    let response = http_response(status, body);
    stream.write_all(&response).await?;
    Ok(())
}

/// Extracts the `loginToken` query param value (first occurrence), percent-decoded.
fn extract_login_token(query: Option<&str>) -> Option<String> {
    let query = query?;
    eprintln!("[SSO] Raw query string: {:?}", query);
    let result = query
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .find(|(key, _)| *key == "loginToken")
        .map(|(_, value)| percent_decode(value));
    eprintln!("[SSO] Extracted loginToken result: {:?}", result);
    result
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
}
