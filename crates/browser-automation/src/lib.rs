use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Schemes the automation browser is allowed to reach. `file://` and other local
/// schemes stay blocked so a page or model prompt cannot read arbitrary disk files.
const ALLOWED_SCHEMES: [&str; 2] = ["http", "https"];

/// Rejects anything that is not a plain web URL. The host is intentionally not
/// restricted, so localhost dev servers work, but local-file and custom schemes do not.
pub fn validate_browser_url(url: &str) -> Result<(), anyhow::Error> {
   let scheme = url
      .split_once("://")
      .map(|(scheme, _)| scheme.to_ascii_lowercase())
      .unwrap_or_default();

   if !ALLOWED_SCHEMES.contains(&scheme.as_str()) {
      anyhow::bail!(
         "Blocked URL scheme '{}'. Only http and https URLs can be opened.",
         if scheme.is_empty() {
            "unknown"
         } else {
            &scheme
         }
      );
   }

   Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BrowserResult {
   pub success: bool,
   pub url: String,
   pub title: Option<String>,
   pub extracted_text: Option<String>,
   pub screenshot_base64: Option<String>,
   pub screenshot_path: Option<String>,
   pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BrowserActionInput {
   pub url: String,
   pub action: Option<String>,
   pub selector: Option<String>,
   pub text: Option<String>,
}

pub fn execute_browser_action(
   input: BrowserActionInput,
   screenshot_dir: &str,
) -> Result<BrowserResult, anyhow::Error> {
   let mut result = BrowserResult {
      success: false,
      url: input.url.clone(),
      title: None,
      extracted_text: None,
      screenshot_base64: None,
      screenshot_path: None,
      error: None,
   };

   validate_browser_url(&input.url)?;

   let browser = headless_chrome::Browser::default()?;
   let tab = browser.new_tab()?;

   tab.navigate_to(&input.url)?;
   tab.wait_until_navigated()?;

   let action = input.action.as_deref().unwrap_or("read");

   match action {
      "read" | "navigate" => {}
      "click" => {
         let selector = require_selector(input.selector.as_deref(), "click")?;
         tab.wait_for_element(selector)?.click()?;
      }
      "type" => {
         let selector = require_selector(input.selector.as_deref(), "type")?;
         let element = tab.wait_for_element(selector)?;
         element.click()?;
         element.type_into(input.text.as_deref().unwrap_or_default())?;
      }
      "scroll" => {
         let direction = input.text.as_deref().unwrap_or("down");
         let script = match direction {
            "up" => "window.scrollBy(0, -window.innerHeight)",
            "top" => "window.scrollTo(0, 0)",
            "bottom" => "window.scrollTo(0, document.body.scrollHeight)",
            _ => "window.scrollBy(0, window.innerHeight)",
         };
         tab.evaluate(script, false)?;
      }
      "wait_for" => {
         let selector = require_selector(input.selector.as_deref(), "wait_for")?;
         tab.wait_for_element(selector)?;
      }
      other => anyhow::bail!("Unknown browser action '{}'", other),
   }

   let title = tab.get_title()?;
   result.title = Some(title);

   let html = tab.get_content()?;
   result.extracted_text = Some(html);

   std::fs::create_dir_all(screenshot_dir)?;
   let timestamp = chrono::Utc::now().timestamp();
   let filename = format!("browser_screenshot_{}.png", timestamp);
   let screenshot_path = Path::new(screenshot_dir).join(filename);

   let screenshot_png = tab.capture_screenshot(
      headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
      None,
      None,
      true,
   )?;

   std::fs::write(&screenshot_path, &screenshot_png)?;
   result.screenshot_path = Some(screenshot_path.to_string_lossy().to_string());

   let base64 = base64::engine::general_purpose::STANDARD.encode(&screenshot_png);
   result.screenshot_base64 = Some(base64);

   result.success = true;
   Ok(result)
}

fn require_selector<'a>(selector: Option<&'a str>, action: &str) -> Result<&'a str, anyhow::Error> {
   selector
      .filter(|value| !value.trim().is_empty())
      .ok_or_else(|| anyhow::anyhow!("The '{}' action needs a CSS selector.", action))
}

pub async fn execute_browser_action_async(
   input: BrowserActionInput,
   screenshot_dir: &str,
) -> Result<BrowserResult, anyhow::Error> {
   let screenshot_dir = screenshot_dir.to_string();
   tokio::task::spawn_blocking(move || execute_browser_action(input, &screenshot_dir))
      .await
      .map_err(|e| anyhow::anyhow!("task failed: {}", e))?
}

#[cfg(test)]
mod tests {
   use super::{BrowserActionInput, BrowserResult};

   #[test]
   fn result_serializes_to_the_field_names_the_frontend_reads() {
      let result = BrowserResult {
         success: true,
         url: "https://example.com".into(),
         title: Some("Example".into()),
         extracted_text: Some("<html></html>".into()),
         screenshot_base64: None,
         screenshot_path: Some("/tmp/shot.png".into()),
         error: None,
      };
      let json = serde_json::to_value(&result).unwrap();
      assert_eq!(json["extracted_text"], "<html></html>");
      assert_eq!(json["screenshot_path"], "/tmp/shot.png");
      assert!(json.get("screenshot_base64").is_some());
      assert_eq!(json["success"], true);
   }

   #[test]
   fn action_input_takes_a_url_and_optional_extras() {
      let input: BrowserActionInput =
         serde_json::from_value(serde_json::json!({ "url": "https://example.com" })).unwrap();
      assert_eq!(input.url, "https://example.com");
      assert!(input.action.is_none());
      assert!(input.selector.is_none());
      assert!(input.text.is_none());
   }

   #[test]
   fn url_policy_allows_web_and_localhost_hosts() {
      assert!(super::validate_browser_url("https://example.com").is_ok());
      assert!(super::validate_browser_url("http://localhost:3000/app").is_ok());
      assert!(super::validate_browser_url("http://127.0.0.1:5173").is_ok());
   }

   #[test]
   fn url_policy_blocks_local_files_and_other_schemes() {
      assert!(super::validate_browser_url("file:///etc/passwd").is_err());
      assert!(super::validate_browser_url("file:///C:/Users/me/.ssh/id_rsa").is_err());
      assert!(super::validate_browser_url("data:text/html,<h1>hi</h1>").is_err());
      assert!(super::validate_browser_url("javascript:alert(1)").is_err());
      assert!(super::validate_browser_url("ftp://example.com").is_err());
      assert!(super::validate_browser_url("not a url").is_err());
   }
}
