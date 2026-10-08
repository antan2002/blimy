import { useMemo } from "react";
import { useGitStore } from "@/features/git/stores/git.store";
import { useDiagnosticsStore } from "@/features/diagnostics/stores/diagnostics.store";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { useEditorViewStatusStore } from "@/features/editor/stores/view-status.store";
import { getBufferById } from "@/features/editor/utils/buffer-index";
import { GitBranchIcon, XCircleIcon, WarningIcon } from "@/ui/icons";
import { NotificationsTrigger } from "@/features/notifications/components/notifications-trigger";
import {
  formatIndentation,
  formatLanguageLabel,
  formatLineEnding,
  formatSelection,
} from "./editor-view-status";

function StatusItem({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      className="flex h-full items-center gap-1 px-1.5 transition-colors hover:bg-accent-foreground/10"
      title={title}
    >
      {children}
    </span>
  );
}

export function StatusBar() {
  const branch = useGitStore((state) => state.workspaceGitStatus?.branch);
  const hasChanges = useGitStore((state) => (state.workspaceGitStatus?.files.length ?? 0) > 0);

  const errorCount = useDiagnosticsStore((state) => {
    let errors = 0;
    for (const diagnostics of state.diagnosticsByFile.values()) {
      for (const diagnostic of diagnostics) {
        if (diagnostic.severity === "error") errors++;
      }
    }
    return errors;
  });

  const warningCount = useDiagnosticsStore((state) => {
    let warnings = 0;
    for (const diagnostics of state.diagnosticsByFile.values()) {
      for (const diagnostic of diagnostics) {
        if (diagnostic.severity === "warning") warnings++;
      }
    }
    return warnings;
  });

  const language = useBufferStore((state) => {
    const buffer = state.activeBufferId ? getBufferById(state.buffers, state.activeBufferId) : null;
    if (buffer?.type !== "editor") return null;
    return buffer.languageOverride || buffer.language || null;
  });

  const viewStatus = useEditorViewStatusStore((state) => state.viewStatus);
  const isEditor = language !== null;

  const lineEnding = formatLineEnding(viewStatus.eol);
  const indentation = formatIndentation(viewStatus);
  const selection = formatSelection(viewStatus);

  const commitCount = useMemo(() => {
    if (errorCount + warningCount === 0) return "No problems have been detected.";
    const parts = [
      errorCount === 1 ? "1 error" : `${errorCount} errors`,
      warningCount === 1 ? "1 warning" : `${warningCount} warnings`,
    ];
    return `${parts.join(", ")} in the workspace.`;
  }, [errorCount, warningCount]);

  return (
    <div className="ui-text-sm flex h-6 w-full shrink-0 items-center justify-between border-t border-border bg-accent font-medium text-foreground">
      <div className="flex h-full items-center">
        {branch && (
          <StatusItem
            title={`Git branch ${branch}${hasChanges ? " with uncommitted changes" : ""}`}
          >
            <GitBranchIcon className="size-3.5" />
            <span>
              {branch}
              {hasChanges ? "*" : ""}
            </span>
          </StatusItem>
        )}

        <StatusItem title={commitCount}>
          <span className="flex items-center gap-1">
            <XCircleIcon className="size-3.5" />
            <span>{errorCount}</span>
          </span>
          <span className="ml-1 flex items-center gap-1">
            <WarningIcon className="size-3.5" />
            <span>{warningCount}</span>
          </span>
        </StatusItem>
      </div>

      <div className="flex h-full items-center">
        {isEditor && (
          <>
            <StatusItem
              title={`Line ${viewStatus.line} of ${viewStatus.lineCount}${selection ? `, ${selection.replace(/[()]/g, "")}` : ""}`}
            >
              <span>
                Ln {viewStatus.line}, Col {viewStatus.column}
              </span>
              {selection}
            </StatusItem>

            {indentation && <StatusItem title="Indentation">{indentation}</StatusItem>}

            {lineEnding && <StatusItem title="Line ending">{lineEnding}</StatusItem>}

            {viewStatus.wordWrap && <StatusItem title="Word wrap is on">Wrap</StatusItem>}

            <StatusItem title="Text encoding used when reading and writing files">UTF-8</StatusItem>

            <StatusItem
              title={
                viewStatus.lspActive
                  ? "A language server is attached to this file"
                  : "No language server is attached to this file"
              }
            >
              {formatLanguageLabel(language ?? undefined)}
              {viewStatus.lspActive ? "" : " (no LSP)"}
            </StatusItem>
          </>
        )}

        <span className="flex h-full items-center [&_button]:h-full! [&_button]:w-auto! [&_button]:px-1.5! [&_button]:rounded-none! [&_button]:bg-transparent! [&_button:hover]:!bg-accent-foreground/10 [&_button]:text-current! [&_svg]:size-4!">
          <NotificationsTrigger size="lg" />
        </span>
      </div>
    </div>
  );
}
