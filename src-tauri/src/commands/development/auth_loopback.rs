use crate::app_runtime::BlimyRuntime;
use std::{
   io::{BufRead, BufReader, Write},
   net::{TcpListener, TcpStream},
   sync::{
      Arc, Mutex,
      atomic::{AtomicBool, Ordering},
   },
   time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, command};

/// The port OAuth callbacks come back to. It is deliberately fixed rather than ephemeral:
/// the redirect URL has to be stable so it can be allow-listed once, which a random port
/// could never be.
const LOOPBACK_PORT: u16 = 38217;

/// Path the provider redirects to. Anything else on this listener is refused.
const CALLBACK_PATH: &str = "/callback";

/// How long the port stays reserved waiting for the browser to come back.
const LISTEN_WINDOW: Duration = Duration::from_secs(300);

/// A slow or hostile client must not be able to hold the listener open forever.
const REQUEST_READ_TIMEOUT: Duration = Duration::from_secs(5);

/// Guards against an unbounded request head.
const MAX_REQUEST_HEAD_BYTES: usize = 8 * 1024;

/// Event carrying the reconstructed callback URL to the frontend.
pub const AUTH_LOOPBACK_EVENT: &str = "auth:loopback-callback";

#[derive(Clone)]
struct ActiveLoopback {
   port: u16,
   shutdown: Arc<AtomicBool>,
}

/// The single loopback listener an app instance may hold at once. Several windows can
/// share it, so signing in from a second window reuses the port already in flight.
#[derive(Default)]
pub struct AuthLoopbackListener(Mutex<Option<ActiveLoopback>>);

impl AuthLoopbackListener {
   fn active(&self) -> Option<ActiveLoopback> {
      self.0.lock().ok().and_then(|guard| guard.clone())
   }
}

/// Start listening for the OAuth return leg and report the redirect URL to hand to the
/// provider. Resolves immediately; the callback arrives later as `AUTH_LOOPBACK_EVENT`.
#[command]
pub fn start_auth_loopback(
   app: AppHandle<BlimyRuntime>,
   state: tauri::State<'_, AuthLoopbackListener>,
) -> Result<String, String> {
   if let Some(active) = state.active() {
      return Ok(callback_url(active.port));
   }

   let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT)).map_err(|error| {
      format!(
         "Could not listen on 127.0.0.1:{LOOPBACK_PORT}. Close any other Blimy window that may \
          still be signing in and try again ({error})."
      )
   })?;

   // Bound to the loopback interface only, never a wildcard address: nothing off this
   // machine can reach it.
   let port = listener
      .local_addr()
      .map_err(|error| error.to_string())?
      .port();
   listener
      .set_nonblocking(true)
      .map_err(|error| error.to_string())?;

   let shutdown = Arc::new(AtomicBool::new(false));
   *state
      .0
      .lock()
      .map_err(|_| "loopback state lock poisoned".to_string())? = Some(ActiveLoopback {
      port,
      shutdown: Arc::clone(&shutdown),
   });

   let deadline = Instant::now() + LISTEN_WINDOW;
   std::thread::spawn(move || {
      serve_once(&listener, &app, port, &shutdown, deadline);
      log::info!("Loopback OAuth listener on 127.0.0.1:{port} finished");
   });

   Ok(callback_url(port))
}

/// Release the port. Safe to call when nothing is listening.
#[command]
pub fn stop_auth_loopback(state: tauri::State<'_, AuthLoopbackListener>) {
   if let Ok(mut guard) = state.0.lock() {
      if let Some(active) = guard.take() {
         active.shutdown.store(true, Ordering::Relaxed);
      }
   }
}

fn callback_url(port: u16) -> String {
   format!("http://127.0.0.1:{port}{CALLBACK_PATH}")
}

/// Accept a single callback, hand it to the frontend, then shut down. Polls rather than
/// blocking so cancellation and the deadline are both honoured promptly.
fn serve_once(
   listener: &TcpListener,
   app: &AppHandle<BlimyRuntime>,
   port: u16,
   shutdown: &AtomicBool,
   deadline: Instant,
) {
   while !shutdown.load(Ordering::Relaxed) {
      if Instant::now() >= deadline {
         log::warn!("Loopback OAuth listener on port {port} timed out with no callback");
         return;
      }

      match listener.accept() {
         Ok((mut stream, _)) => {
            handle_request(&mut stream, app, port);
            return;
         }
         Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
            std::thread::sleep(Duration::from_millis(50));
         }
         Err(error) => {
            log::warn!("Loopback OAuth listener on port {port} stopped accepting: {error}");
            return;
         }
      }
   }
}

fn handle_request(stream: &mut TcpStream, app: &AppHandle<BlimyRuntime>, port: u16) {
   let outcome = match read_request_head(stream) {
      Ok(head) => parse_callback_target(&head.request_line, &head.host, port),
      Err(error) => Err(error),
   };

   match outcome {
      Ok(target) => {
         respond(
            stream,
            "200 OK",
            "Signed in. You can close this tab and return to Blimy.",
         );
         let url = format!("http://127.0.0.1:{port}{target}");
         if let Err(error) = app.emit(AUTH_LOOPBACK_EVENT, url.clone()) {
            log::error!("Failed to deliver the loopback callback: {error}");
         } else {
            log::info!("Received OAuth callback on port {port}");
         }
      }
      Err(error) => {
         log::warn!("Refused a loopback request on port {port}: {error}");
         respond(
            stream,
            "400 Bad Request",
            "This sign-in link is not valid. Close this tab and start again from Blimy.",
         );
      }
   }
}

struct RequestHead {
   request_line: String,
   host: String,
}

fn read_request_head(stream: &TcpStream) -> Result<RequestHead, String> {
   stream
      .set_read_timeout(Some(REQUEST_READ_TIMEOUT))
      .map_err(|error| error.to_string())?;

   let mut reader = BufReader::new(stream);
   let mut request_line = String::new();
   reader
      .read_line(&mut request_line)
      .map_err(|error| error.to_string())?;

   let mut host = String::new();
   let mut consumed = request_line.len();
   loop {
      let mut line = String::new();
      let read = reader
         .read_line(&mut line)
         .map_err(|error| error.to_string())?;
      if read == 0 {
         break;
      }
      consumed += read;
      if consumed > MAX_REQUEST_HEAD_BYTES {
         return Err("request head exceeded the size limit".to_string());
      }

      let trimmed = line.trim_end();
      if trimmed.is_empty() {
         break;
      }
      if let Some(value) = trimmed
         .strip_prefix("Host:")
         .or_else(|| trimmed.strip_prefix("host:"))
      {
         host = value.trim().to_string();
      }
   }

   Ok(RequestHead {
      request_line: request_line.trim_end().to_string(),
      host,
   })
}

/// Validate the request and return the request target (`/callback?code=...`).
///
/// The `Host` check is what stops DNS rebinding: without it a page could resolve its own
/// attacker-controlled name to 127.0.0.1 and have the browser issue this request on its
/// behalf, which would let a web page read the authorization code.
fn parse_callback_target(request_line: &str, host: &str, port: u16) -> Result<String, String> {
   let mut parts = request_line.split_whitespace();
   let method = parts.next().ok_or("empty request line")?;
   if method != "GET" {
      return Err(format!("unexpected method {method}"));
   }

   let target = parts.next().ok_or("missing request target")?;
   let path = target.split('?').next().unwrap_or_default();
   if path != CALLBACK_PATH {
      return Err(format!("unexpected path {path}"));
   }

   let expected = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
   if !expected
      .iter()
      .any(|allowed| allowed.eq_ignore_ascii_case(host))
   {
      return Err(format!(
         "Host header {host:?} does not match the listening port"
      ));
   }

   Ok(target.to_string())
}

fn respond(stream: &mut TcpStream, status: &str, message: &str) {
   let body = format!(
      "<!doctype html><html><head><meta charset=\"utf-8\"><title>Blimy</title></head><body \
       style=\"font-family:system-ui;margin:0;display:grid;place-items:center;min-height:100vh;\
       background:#111;color:#eee\"><p>{message}</p></body></html>"
   );
   let response = format!(
      "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: \
       {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
      body.len()
   );
   let _ = stream.write_all(response.as_bytes());
   let _ = stream.flush();
}

#[cfg(test)]
mod tests {
   use super::*;

   #[test]
   fn accepts_a_loopback_callback() {
      let target = parse_callback_target(
         "GET /callback?code=abc123&state=xyz HTTP/1.1",
         "127.0.0.1:38217",
         LOOPBACK_PORT,
      )
      .expect("a well-formed callback");

      assert_eq!(target, "/callback?code=abc123&state=xyz");
   }

   #[test]
   fn accepts_localhost_as_the_host() {
      let target = parse_callback_target(
         "GET /callback?code=abc HTTP/1.1",
         "localhost:38217",
         LOOPBACK_PORT,
      )
      .expect("localhost resolves to the loopback listener");

      assert_eq!(target, "/callback?code=abc");
   }

   #[test]
   fn rejects_a_host_pointing_elsewhere() {
      let error = parse_callback_target(
         "GET /callback?code=abc HTTP/1.1",
         "attacker.example.com",
         LOOPBACK_PORT,
      )
      .expect_err("DNS rebinding must be refused");

      assert!(
         error.contains("does not match"),
         "unexpected error: {error}"
      );
   }

   #[test]
   fn rejects_a_foreign_port() {
      assert!(
         parse_callback_target(
            "GET /callback?code=abc HTTP/1.1",
            "127.0.0.1:9999",
            LOOPBACK_PORT,
         )
         .is_err()
      );
   }

   #[test]
   fn rejects_other_paths() {
      assert!(
         parse_callback_target(
            "GET /steal?code=abc HTTP/1.1",
            "127.0.0.1:38217",
            LOOPBACK_PORT,
         )
         .is_err()
      );
   }

   #[test]
   fn rejects_non_get_methods() {
      assert!(
         parse_callback_target("POST /callback HTTP/1.1", "127.0.0.1:38217", LOOPBACK_PORT,)
            .is_err()
      );
   }

   #[test]
   fn builds_the_redirect_url_from_the_bound_port() {
      assert_eq!(callback_url(38217), "http://127.0.0.1:38217/callback");
   }
}
