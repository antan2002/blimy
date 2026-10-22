import { ensureStartupAppearanceApplied } from "@/features/settings/lib/appearance-bootstrap";

function renderFatal(message: string, detail?: unknown) {
  const detailText =
    detail instanceof Error ? detail.stack || detail.message : String(detail ?? "");
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 24px; max-width: 560px; color: #f4f4f5; background: #18181b; border: 1px solid #27272a; border-radius: 8px; margin: 24px auto;" role="alert">
      <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #ef4444;">${message}</div>
      ${
        detailText
          ? `<pre style="font-size: 12px; opacity: 0.9; white-space: pre-wrap; margin: 0; color: #d4d4d8; background: #09090b; padding: 12px; border-radius: 6px; overflow: auto; max-height: 400px;">${detailText}</pre>`
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
