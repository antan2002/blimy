import { ensureStartupAppearanceApplied } from "@/features/settings/lib/appearance-bootstrap";

ensureStartupAppearanceApplied();

window.addEventListener("error", (e) => {
  document.body.innerHTML += `<div style="position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:999999;font-size:16px;">ERROR: ${e.message} <br/><pre>${e.error?.stack}</pre></div>`;
});
window.addEventListener("unhandledrejection", (e) => {
  document.body.innerHTML += `<div style="position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:999999;font-size:16px;">PROMISE REJECTION: ${e.reason?.message || e.reason} <br/><pre>${e.reason?.stack}</pre></div>`;
});
