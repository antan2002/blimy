import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { toast } from "sonner";
import Badge, { type BadgeTone } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty";
import { ArrowRightIcon, CopyIcon, ShieldCheckIcon } from "@/ui/icons";
import { ScrollArea } from "@/ui/scroll-area";
import { Spinner } from "@/ui/spinner";
import type {
  PullRequestFinding,
  PullRequestReviewResult,
} from "@/features/ai/pr-review/pr-review-report";
import {
  prReviewKey,
  selectPrReviewEntry,
  usePrReviewStore,
} from "@/features/ai/pr-review/pr-review.store";
import { sendReviewToAgentChat } from "@/features/ai/pr-review/send-review-to-agent-chat";

const SEVERITY_ORDER = ["critical", "warning", "suggestion"] as const;

const SEVERITY_LABEL: Record<PullRequestFinding["severity"], string> = {
  critical: "Critical",
  warning: "Warning",
  suggestion: "Suggestion",
};

const SEVERITY_TONE: Record<PullRequestFinding["severity"], BadgeTone> = {
  critical: "danger",
  warning: "warning",
  suggestion: "neutral",
};

const VERDICT_LABEL: Record<PullRequestReviewResult["verdict"], string> = {
  approve: "Looks good",
  request_changes: "Changes requested",
  comment: "Comments",
};

export function buildReviewMarkdown(result: PullRequestReviewResult): string {
  const lines = ["## PR review", "", result.summary, ""];

  if (result.findings.length === 0) {
    lines.push("No problems found.");
    return lines.join("\n");
  }

  for (const severity of SEVERITY_ORDER) {
    const group = result.findings.filter((finding) => finding.severity === severity);

    if (group.length === 0) continue;

    lines.push(`### ${SEVERITY_LABEL[severity]} (${group.length})`);

    for (const finding of group) {
      lines.push(
        `- **${finding.title}** - \`${finding.file}:${finding.line}\` (${finding.category})`,
      );
      lines.push(`  ${finding.body}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function FindingCard({
  finding,
  onOpenFile,
}: {
  finding: PullRequestFinding;
  onOpenFile: (filePath: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <Badge tone={SEVERITY_TONE[finding.severity]}>{SEVERITY_LABEL[finding.severity]}</Badge>
        <Button variant="link" size="inline" onClick={() => onOpenFile(finding.file)}>
          {finding.file}:{finding.line}
        </Button>
      </div>
      <div className="font-sans ui-text-sm font-medium text-foreground">{finding.title}</div>
      <p className="font-sans ui-text-sm text-muted-foreground">{finding.body}</p>
      {finding.suggestion ? (
        <pre className="overflow-x-auto rounded-sm bg-accent p-2 font-mono ui-text-caption text-foreground">
          <code>{finding.suggestion}</code>
        </pre>
      ) : null}
    </div>
  );
}

interface PrReviewPanelProps {
  repoPath: string;
  prNumber: number;
  /** Jumps to a changed file in the Changes view. */
  onOpenFile: (filePath: string) => void;
  /** Copies the review as Markdown, so the caller keeps clipboard ownership. */
  onCopy?: (markdown: string) => void;
}

export function PrReviewPanel({ repoPath, prNumber, onOpenFile, onCopy }: PrReviewPanelProps) {
  const entry = usePrReviewStore(selectPrReviewEntry(prReviewKey(repoPath, prNumber)));
  const run = usePrReviewStore.use.actions().run;
  const onRun = () => void run({ repoPath, prNumber });
  const [publishing, setPublishing] = useState(false);

  if (entry.status === "running") {
    return (
      <div className="flex flex-1 items-center justify-center p-3">
        <Spinner showLabel label="Reviewing the pull request..." />
      </div>
    );
  }

  if (entry.status === "error") {
    return (
      <EmptyState
        tone="error"
        icon={<ShieldCheckIcon />}
        title="Review failed"
        message={entry.error ?? "Unable to review this pull request."}
        action={{ label: "Try again", onClick: onRun }}
      />
    );
  }

  if (entry.status !== "ready" || !entry.result) {
    return (
      <EmptyState
        icon={<ShieldCheckIcon />}
        title="No review yet"
        message="Run an AI review of this pull request's diff. Findings stay here until you send them to the agent."
        action={{ label: "Review pull request", onClick: onRun }}
      />
    );
  }

  const { result } = entry;
  const markdown = buildReviewMarkdown(result);

  const handleSendToAgent = () => {
    sendReviewToAgentChat(markdown);
  };

  const handlePublish = async () => {
    setPublishing(true);

    try {
      await invoke("github_submit_pr_review", {
        repoPath,
        prNumber,
        event: "COMMENT",
        body: markdown,
      });
      toast.success("Review published to the pull request.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to publish the review.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollArea fill="flex" contentPadding="md" contentGap="md">
      {result.findings.length === 0 ? (
        <EmptyState
          variant="inline"
          tone="success"
          title="No problems found"
          message={result.summary || VERDICT_LABEL[result.verdict]}
          action={{ label: "Re-run review", onClick: onRun }}
        />
      ) : (
        SEVERITY_ORDER.map((severity) => {
          const group = result.findings.filter((finding) => finding.severity === severity);

          if (group.length === 0) return null;

          return (
            <div key={severity} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-sans ui-text-sm font-medium text-foreground">
                  {SEVERITY_LABEL[severity]}
                </span>
                <Badge tone={SEVERITY_TONE[severity]}>{group.length}</Badge>
              </div>
              {group.map((finding) => (
                <FindingCard
                  key={`${finding.file}:${finding.line}:${finding.title}`}
                  finding={finding}
                  onOpenFile={onOpenFile}
                />
              ))}
            </div>
          );
        })
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="accent" size="md" onClick={handleSendToAgent}>
          <ArrowRightIcon />
          Send to agent
        </Button>
        <Button
          variant="default"
          size="md"
          onClick={() => void handlePublish()}
          disabled={publishing}
        >
          <ShieldCheckIcon />
          Publish comment
        </Button>
        <Button variant="ghost" size="md" onClick={() => onCopy?.(markdown)} disabled={!onCopy}>
          <CopyIcon />
          Copy review
        </Button>
        <Button variant="ghost" size="md" onClick={onRun}>
          <ArrowRightIcon />
          Re-run
        </Button>
        <span className="font-sans ui-text-caption text-muted-foreground">{entry.modelLabel}</span>
      </div>
    </ScrollArea>
  );
}
