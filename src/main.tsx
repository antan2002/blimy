import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.tsx";
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

createRoot(document.getElementById("root")!).render(<App />);
traceWindowOpen("reactRender:scheduled", {
  durationMs: Math.round((performance.now() - renderStartedAt) * 100) / 100,
});
recordStartupMilestone("react:scheduled");
