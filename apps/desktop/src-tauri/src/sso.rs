//! SSO loopback listener.
//!
//! Opens a one-shot HTTP server on `127.0.0.1:1421` that captures the
//! `code` or `loginToken` query params Synapse redirects back after the Google OIDC flow:
//! `http://127.0.0.1:1421/callback?loginToken=...`.
//!
//! Two Tauri commands wrap this module (see `lib.rs`):
//! - `begin_sso_listener() -> u16`: starts the listener and returns the port;
//! - `finish_sso_listener(port) -> String`: resolves with the captured `code`/`loginToken`,
//!   or rejects after 5 minutes / if the listener was consumed.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio::task::AbortHandle;

/// How long the listener waits for the browser round-trip (5 minutes).
const SSO_TIMEOUT: Duration = Duration::from_secs(5 * 60);

/// Fixed loopback port used for the SSO callback. Must match the
/// `redirect_uris` registered on Synapse (port 1421).
const SSO_PORT: u16 = 1421;

const CALLBACK_HTML: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">\
<title>Echo</title></head><body style=\"background:#0b0e14;color:#F1F5F9;font-family:sans-serif;\
display:grid;place-items:center;height:100vh;margin:0\">\
<div style=\"text-align:center;\">\
<h2 style=\"color:#0FB9A8;margin-bottom:8px;\">Login concluído</h2>\
<p style=\"color:#94A3B8;\">Você já pode voltar ao aplicativo Echo.</p>\
</div></body></html>";

const MISSING_CODE_HTML: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">\
<title>Echo</title></head><body style=\"background:#0b0e14;color:#EF4444;font-family:sans-serif;\
display:grid;place-items:center;height:100vh;margin:0\">\
<p>Token de autentica\u{e7}\u{e3}o ausente no retorno.</p></body></html>";

fn http_response(status: &str, body: &str) -> Vec<u8> {
    format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
        status,
        body.len(),
        body
    )
    .into_bytes()
}

/// Port -> receiver of the captured authorization code (one-shot, removed on read).
static LISTENERS: LazyLock<Mutex<HashMap<u16, mpsc::Receiver<String>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Handle of the active background listener task (allows cancelling previous listeners on retry).
static ACTIVE_LISTENER: LazyLock<Mutex<Option<AbortHandle>>> =
    LazyLock::new(|| Mutex::new(None));

pub async fn begin_sso_listener() -> Result<u16, String> {
    eprintln!("[SSO] begin_sso_listener called, attempting to bind to port {}", SSO_PORT);

    // If an existing listener task is running from a prior attempt, abort it to release port 1421
    let prior_handle = if let Ok(mut lock) = ACTIVE_LISTENER.lock() {
        lock.take()
    } else {
        None
    };
    if let Some(handle) = prior_handle {
        eprintln!("[SSO] Aborting prior listener task to free port {}", SSO_PORT);
        handle.abort();
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    let (tx, rx) = mpsc::channel::<String>(1);

    // Save rx into LISTENERS
    {
        let mut listeners = LISTENERS
            .lock()
            .map_err(|_| "mutex do listener SSO envenenado".to_string())?;
        listeners.insert(SSO_PORT, rx);
    }

    let addr = format!("127.0.0.1:{SSO_PORT}");
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("falha ao bindar listener SSO na porta {SSO_PORT}: {e}"))?;

    eprintln!("[SSO] Listener started successfully on port {SSO_PORT} (IPv4 127.0.0.1)");

    let join_handle = tokio::spawn(async move {
        accept_loop(listener, tx).await;
    });

    if let Ok(mut lock) = ACTIVE_LISTENER.lock() {
        *lock = Some(join_handle.abort_handle());
    }

    Ok(SSO_PORT)
}

/// Consumes the listener registered for `port` and resolves with the
/// authorization `code`; rejects on timeout or if the listener no longer exists.
pub async fn finish_sso_listener(port: u16) -> Result<String, String> {
    let mut rx = LISTENERS
        .lock()
        .map_err(|_| "mutex do listener SSO envenenado".to_string())?
        .remove(&port)
        .ok_or_else(|| "listener SSO não encontrado ou já consumido".to_string())?;

    match tokio::time::timeout(SSO_TIMEOUT, rx.recv()).await {
        Ok(Some(code)) => {
            eprintln!("[SSO] finish_sso_listener: code received successfully");
            // Abort the listener task now that we have the code, so the port is freed
            if let Ok(mut lock) = ACTIVE_LISTENER.lock() {
                if let Some(handle) = lock.take() {
                    handle.abort();
                }
            }
            Ok(code)
        }
        Ok(None) => {
            eprintln!("[SSO] finish_sso_listener: channel closed without code");
            Err("listener SSO cancelado antes de receber o código".to_string())
        }
        Err(_) => {
            eprintln!("[SSO] finish_sso_listener: timeout waiting for code");
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
                eprintln!("[SSO] accept loop ended: {:?}", e);
                break;
            }
        }
    }
}

/// Handles a single HTTP connection: reads the request asynchronously, extracts authorization code,
/// sends the code via channel, and sends an HTML response back to the browser gracefully.
async fn handle_connection(
    mut stream: tokio::net::TcpStream,
    tx: mpsc::Sender<String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = Vec::with_capacity(4096);

    // Read with timeout (up to 10 seconds for browser request)
    let read_res: Result<Result<Option<usize>, std::io::Error>, _> =
        tokio::time::timeout(Duration::from_secs(10), async {
            let mut chunk = [0u8; 1024];
            loop {
                let n = stream.read(&mut chunk).await?;
                if n == 0 {
                    break; // Connection closed by client
                }
                buf.extend_from_slice(&chunk[..n]);

                if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                    return Ok(Some(pos + 4));
                }

                if buf.len() > 16384 {
                    return Ok(None);
                }
            }
            Ok(None)
        })
        .await;

    let header_end = match read_res {
        Ok(Ok(Some(pos))) => pos,
        Ok(Ok(None)) => {
            // Speculative empty connection or connection closed before headers
            return Ok(());
        }
        Ok(Err(e)) => {
            return Err(e.into());
        }
        Err(_) => {
            // Timeout reading headers
            return Ok(());
        }
    };

    // Parse the request line to get the path and query
    let header_str = String::from_utf8_lossy(&buf[..header_end]);
    let first_line = header_str.lines().next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();

    let method = parts.get(0).copied().unwrap_or("");
    let path_and_query = parts.get(1).copied().unwrap_or("");
    let (path, query) = match path_and_query.split_once('?') {
        Some((p, q)) => (p, Some(q)),
        None => (path_and_query, None),
    };

    eprintln!("[SSO] Request: {} {} (path: {}, query: {:?})", method, path_and_query, path, query);

    // Fast-path for browser favicon requests: respond with 204 No Content and close
    if path == "/favicon.ico" {
        let res = b"HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(res).await;
        let _ = stream.flush().await;
        let _ = stream.shutdown().await;
        return Ok(());
    }

    // Extract authorization code from query string
    let code = extract_auth_code(query);

    let (status, body) = match code {
        Some(ref c) => {
            eprintln!("[SSO] Code extracted: {}", c);
            // Send code to the waiting finish_sso_listener channel
            match tx.send(c.clone()).await {
                Ok(()) => eprintln!("[SSO] Code sent to finish_sso_listener channel"),
                Err(e) => eprintln!("[SSO] Receiver already consumed or closed: {:?}", e),
            }
            ("200 OK", CALLBACK_HTML)
        }
        None => {
            eprintln!("[SSO] No authorization code in query");
            ("400 Bad Request", MISSING_CODE_HTML)
        }
    };

    let response = http_response(status, body);
    stream.write_all(&response).await?;
    stream.flush().await?;
    let _ = stream.shutdown().await;
    Ok(())
}

/// Extracts the `loginToken` or `code` query param value (first occurrence), percent-decoded.
fn extract_auth_code(query: Option<&str>) -> Option<String> {
    let query = query?;
    eprintln!("[SSO] Raw query string: {:?}", query);
    let result = query
        .split('&')
        .filter_map(|pair| pair.split_once('='))
        .find(|(key, _)| *key == "loginToken" || *key == "code")
        .map(|(_, value)| percent_decode(value));
    eprintln!("[SSO] Extracted token result: {:?}", result);
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
    fn extract_auth_code_reads_code_query_param() {
        assert_eq!(
            extract_auth_code(Some("code=abc123")),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn extract_auth_code_reads_login_token_query_param() {
        assert_eq!(
            extract_auth_code(Some("loginToken=abc123")),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn extract_auth_code_ignores_other_params_and_percent_decodes() {
        assert_eq!(
            extract_auth_code(Some("foo=1&loginToken=abc%2Ddef")),
            Some("abc-def".to_string())
        );
        assert_eq!(
            extract_auth_code(Some("foo=1&code=xyz%2D123")),
            Some("xyz-123".to_string())
        );
        assert_eq!(extract_auth_code(Some("other=1")), None);
        assert_eq!(extract_auth_code(None), None);
    }

    #[tokio::test]
    async fn loopback_sso_roundtrip_test() {
        use tokio::net::TcpStream;

        let port = begin_sso_listener().await.expect("listener must start");
        assert_eq!(port, 1421);

        // Simulate browser request
        let mut client = TcpStream::connect("127.0.0.1:1421").await.expect("must connect to loopback");
        let req = "GET /callback?loginToken=syl_test_integration_token_123 HTTP/1.1\r\nHost: 127.0.0.1:1421\r\nConnection: close\r\n\r\n";
        client.write_all(req.as_bytes()).await.expect("must write request");
        client.flush().await.expect("must flush request");

        let mut res = Vec::new();
        client.read_to_end(&mut res).await.expect("must read response to end without disconnect error");
        let res_str = String::from_utf8_lossy(&res);
        assert!(res_str.starts_with("HTTP/1.1 200 OK"), "Expected 200 OK, got: {}", res_str);
        assert!(res_str.contains("Login conclu"), "Response must contain Login concluído");

        let code = finish_sso_listener(port).await.expect("must receive code");
        assert_eq!(code, "syl_test_integration_token_123");
    }
}
