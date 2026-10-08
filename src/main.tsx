import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/app-error-boundary.tsx";
import { parseDetachedWindowUrl } from "./features/window/detached/detached-window-protocol";
import { installDevelopmentPerformanceMeasureCleanup } from "./features/bootstrap/performance-measure-retention.ts";
import { recordStartupMilestone } from "./features/bootstrap/startup-performance.ts";
import { initializeFrontendTerminalSession } from "./features/terminal/utils/frontend-terminal-session.ts";
import { traceWindowOpen } from "./features/window/utils/window-open-diagnostics.ts";
import { removeLegacyAuthTokenOnce } from "./features/auth/lib/migrate-legacy-auth-key.ts";

if (import.meta.env.DEV) {
  installDevelopmentPerformanceMeasureCleanup();
}

traceWindowOpen("frontend:entry");
recordStartupMilestone("frontend:entry");

removeLegacyAuthTokenOnce().catch(console.error);

// A missing Supabase config must explain itself, not leave a black window.
const missingEnv = [
  ["VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL],
  ["VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY],
].filter(([, value]) => !value);

if (missingEnv.length > 0) {
  const names = missingEnv.map(([name]) => name).join(", ");
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="font-family: system-ui, sans-serif; padding: 24px; max-width: 560px;">
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">
          Blimy is not configured
        </div>
        <div style="font-size: 13px; opacity: 0.8; line-height: 1.5;">
          Missing environment variable(s): <strong>${names}</strong>. Add them to a
          <code style="font-family: ui-monospace, monospace;">.env</code> file in the project root
          and restart.
        </div>
      </div>`;
  }
  throw new Error(`Missing required environment variable(s): ${names}`);
}

const renderStartedAt = performance.now();
traceWindowOpen("reactRender:start");

// Stale-connection cleanup runs alongside the first render instead of gating it.
// Terminal creation awaits the session through ensureFrontendTerminalSession,
// so nothing registers a terminal before the backend knows this session.
if (!parseDetachedWindowUrl(new URL(window.location.href))) {
  void initializeFrontendTerminalSession().catch((error) => {
    console.warn("Failed to clean up stale terminal sessions:", error);
  });
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
traceWindowOpen("reactRender:scheduled", {
  durationMs: Math.round((performance.now() - renderStartedAt) * 100) / 100,
});
recordStartupMilestone("react:scheduled");
