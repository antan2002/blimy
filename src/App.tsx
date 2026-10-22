import { Suspense, useEffect, useMemo, useState } from "react";
import { parseDetachedWindowUrl } from "@/features/window/detached/detached-window-protocol";
import { Spinner } from "@/ui/spinner";
import { recordStartupMilestoneAfterFrame } from "@/features/bootstrap/startup-performance";
import {
  getWindowOpenDiagnostics,
  traceWindowOpen,
  traceWindowOpenAfterFrame,
} from "@/features/window/utils/window-open-diagnostics";
import { lazyWithRetry } from "@/utils/lazy-with-retry";
import { safeGetCurrentWindow } from "@/utils/safe-tauri-window";

const WorkbenchApp = lazyWithRetry(() => import("./workbench-app"));
const DetachedAgentWindow = lazyWithRetry(
  () => import("./features/ai/detached/detached-agent-window"),
);
const DetachedResourceWindow = lazyWithRetry(
  () => import("./features/window/detached/detached-resource-window"),
);

const StandaloneContentWindow = lazyWithRetry(
  () => import("./features/window/detached/standalone-content-window"),
);

function isBlankWindowOpen() {
  const diagnostics = getWindowOpenDiagnostics();
  return Boolean(diagnostics.traceId && !diagnostics.target);
}

function handleInitialWindowShellMouseDown(event: React.MouseEvent<HTMLDivElement>) {
  if (event.button !== 0) return;

  void safeGetCurrentWindow()
    ?.startDragging()
    .catch(() => {});
}

function InitialWindowShell() {
  return (
    <div className="blimy-layout-shell relative h-dvh w-dvw overflow-hidden bg-surface">
      <div
        className="blimy-title-bar absolute inset-x-0 top-0 h-title-bar bg-transparent"
        data-tauri-drag-region
        onMouseDown={handleInitialWindowShellMouseDown}
      />
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        <Spinner className="size-6" />
      </div>
    </div>
  );
}

interface WorkbenchBoundaryProps {
  blankWindowOpen: boolean;
}

function WorkbenchBoundary({ blankWindowOpen }: WorkbenchBoundaryProps) {
  useEffect(() => {
    const readyAt = performance.now();
    traceWindowOpen("app:workbenchReady", { blankWindowOpen });
    return traceWindowOpenAfterFrame("app:workbenchReadyFrame", () => ({
      shell: true,
      blankWindowOpen,
      durationMs: Math.round((performance.now() - readyAt) * 100) / 100,
    }));
  }, [blankWindowOpen]);

  return <WorkbenchApp />;
}

function App() {
  const detachedWindow = useMemo(() => parseDetachedWindowUrl(new URL(window.location.href)), []);
  const blankWindowOpen = useMemo(() => isBlankWindowOpen(), []);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const mountedAt = performance.now();
    void safeGetCurrentWindow()?.show().catch(console.error);
    traceWindowOpen("app:mounted", { shell: true, blankWindowOpen });
    const cleanupTrace = traceWindowOpenAfterFrame("app:firstFrame", () => ({
      shell: true,
      blankWindowOpen,
      durationMs: Math.round((performance.now() - mountedAt) * 100) / 100,
    }));
    const cleanupStartupMilestone = recordStartupMilestoneAfterFrame("app:first-frame");

    return () => {
      cleanupTrace();
      cleanupStartupMilestone();
    };
  }, [blankWindowOpen]);

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-9999 bg-destructive text-white text-xs font-semibold px-4 py-1.5 text-center flex items-center justify-center gap-2 shadow-md">
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          blimy-offline: Internet connection lost. AI web search features are unavailable.
        </div>
      )}
      <Suspense fallback={<InitialWindowShell />}>
        {detachedWindow?.kind === "agent" ? (
          <DetachedAgentWindow />
        ) : detachedWindow?.kind === "standalone" ? (
          <StandaloneContentWindow />
        ) : detachedWindow?.kind === "resource" ? (
          <DetachedResourceWindow />
        ) : (
          <WorkbenchBoundary blankWindowOpen={blankWindowOpen} />
        )}
      </Suspense>
    </>
  );
}

export default App;
