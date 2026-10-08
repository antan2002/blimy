import { ensureStartupAppearanceApplied } from "@/features/settings/lib/appearance-bootstrap";

function renderFatal(message: string, detail?: unknown) {
  const detailText =
    detail instanceof Error ? detail.stack || detail.message : String(detail ?? "");
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 24px; max-width: 560px;" role="alert">
      <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">${message}</div>
      ${
        detailText
          ? `<pre style="font-size: 12px; opacity: 0.8; white-space: pre-wrap; margin: 0;">${detailText}</pre>`
          : ""
      }
    </div>`;
}

window.addEventListener("error", (e) => {
  renderFatal("Blimy hit a startup error.", e.error ?? e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  renderFatal("Blimy hit a startup error.", e.reason);
});

try {
  ensureStartupAppearanceApplied();
} catch (error) {
  console.error("Failed to apply startup appearance:", error);
  // Theme bootstrap must never block the app; defaults apply in CSS instead.
}
