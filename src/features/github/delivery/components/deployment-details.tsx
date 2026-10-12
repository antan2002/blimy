import type { ReactNode } from "react";
import { openDeploymentLog } from "../services/open-deployment-log";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import Badge from "@/ui/badge";
import { Button } from "@/ui/button";
import { GitBranchIcon, GitCommitIcon, RocketIcon, OpenExternalIcon } from "@/ui/icons";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/ui/item";
import { ResourceSection, ResourceSidebarLayout, ResourceSummary } from "@/ui/resource";
import { GitHubMetaChip, GitHubUserChip } from "../../components/github-chips";
import { getTimeAgo } from "../../utils/github-viewer-utils";
import type { Deployment } from "../types/github-delivery.types";
import { deploymentState, deploymentStatusState, safeDeliveryUrl } from "../utils/github-delivery";
import { useEffect, useState } from "react";
import { getCommitDiff } from "@/features/git/api/git-diff-api";
import { countDiffStats } from "@/features/git/utils/git-diff-helpers";
import type { MultiFileDiff } from "@/features/git/types/git-diff.types";
import GitDiffEditorStack from "@/features/git/components/diff/git-diff-editor-stack";
import { Spinner } from "@/ui/spinner";
import { Alert, AlertTitle, AlertDescription, AlertActions } from "@/ui/alert";
import { fetchChanges } from "@/features/git/api/git-remotes-api";
export function DeploymentSummary({
  deployment,
  actions,
}: {
  deployment: Deployment;
  actions?: ReactNode;
}) {
  const state = deploymentState(deployment);
  return (
    <ResourceSummary
      actions={actions}
      icon={<RocketIcon className="text-subtle-foreground" />}
      title={<span className="block truncate">{deployment.environment}</span>}
      badges={
        <>
          <Badge tone={state.tone}>{state.label}</Badge>
          {deployment.production_environment ? <Badge tone="accent">Production</Badge> : null}
          {deployment.transient_environment ? <Badge>Preview</Badge> : null}
        </>
      }
      description={deployment.description}
      meta={
        <>
          {deployment.creator ? (
            <GitHubUserChip
              login={deployment.creator.login}
              avatarUrl={deployment.creator.avatar_url}
              title={`Deployed by ${deployment.creator.login}. Open profile on GitHub`}
            />
          ) : null}
          <GitHubMetaChip title={new Date(deployment.created_at).toLocaleString()}>
            {`Created ${getTimeAgo(deployment.created_at)}`}
          </GitHubMetaChip>
          <GitHubMetaChip mono icon={<GitBranchIcon />} title="Reference">
            {deployment.ref}
          </GitHubMetaChip>
          <GitHubMetaChip mono icon={<GitCommitIcon />} title={deployment.sha}>
            {deployment.sha.slice(0, 7)}
          </GitHubMetaChip>
        </>
      }
    />
  );
}

export function DeploymentDetails({
  deployment,
  repoPath,
}: {
  deployment: Deployment;
  repoPath: string;
}) {
  const latest = deployment.statuses[0];
  const [multiDiff, setMultiDiff] = useState<MultiFileDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(true);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  useEffect(() => {
    let active = true;
    setDiffLoading(true);
    getCommitDiff(repoPath, deployment.sha)
      .then((diffs) => {
        if (!active) return;
        if (!diffs || diffs.length === 0) {
          setMultiDiff(null);
          setDiffError("No local changes found for this commit. You may need to fetch.");
        } else {
          const shortHash = deployment.sha.substring(0, 7);
          const { additions, deletions } = countDiffStats(diffs);
          setMultiDiff({
            title: `Commit ${shortHash}`,
            repoPath,
            commitHash: deployment.sha,
            commitMessage: deployment.description || undefined,
            files: diffs,
            totalFiles: diffs.length,
            totalAdditions: additions,
            totalDeletions: deletions,
          });
          setDiffError(null);
        }
      })
      .catch((err) => {
        if (active) setDiffError(String(err));
      })
      .finally(() => {
        if (active) setDiffLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repoPath, deployment.sha, deployment.description, fetchAttempt]);

  const handleFetch = async () => {
    setIsFetchingRemote(true);
    const result = await fetchChanges(repoPath);
    if (!result.success) {
      toast.error(`Failed to fetch: ${result.error || "Unknown error"}`);
    }
    setIsFetchingRemote(false);
    setFetchAttempt((prev) => prev + 1);
  };
  const environmentUrl = safeDeliveryUrl(latest?.environment_url);
  const open = (url: string) => {
    void openUrl(url).catch((error) => toast.error(String(error)));
  };
  return (
    <ResourceSidebarLayout
      sidebar={
        <>
          {latest?.environment && latest.environment !== deployment.environment ? (
            <ResourceSection title="Environment">
              <span className="break-all">{latest.environment}</span>
            </ResourceSection>
          ) : null}
          <ResourceSection title="Commit">
            <span className="break-all font-mono">{deployment.sha}</span>
          </ResourceSection>
          <ResourceSection title="Task">{deployment.task}</ResourceSection>
          {environmentUrl ? (
            <ResourceSection title="Environment URL">
              <Button variant="ghost" onClick={() => open(environmentUrl)} tooltip={environmentUrl}>
                <OpenExternalIcon /> Open Environment
              </Button>
            </ResourceSection>
          ) : null}
        </>
      }
    >
      <div className="space-y-8">
        <ResourceSection title={`Status history (${deployment.statuses.length})`}>
          <ItemGroup>
            {deployment.statuses.map((status, index) => {
              const state = deploymentStatusState(status.state);
              const logUrl = safeDeliveryUrl(status.log_url);
              return (
                <Item role="listitem" key={status.id} variant={index === 0 ? "muted" : "default"}>
                  <ItemContent>
                    <ItemTitle>
                      <Badge tone={state.tone}>{state.label}</Badge>
                      {index === 0 ? "Latest" : null}
                    </ItemTitle>
                    <ItemDescription>
                      {status.description || "No status description"}
                    </ItemDescription>
                    <ItemDescription>
                      <time
                        dateTime={status.created_at}
                        title={new Date(status.created_at).toLocaleString()}
                      >
                        {getTimeAgo(status.created_at)}
                      </time>
                      {status.creator ? ` · ${status.creator.login}` : ""}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {logUrl && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          void openDeploymentLog(logUrl).catch((error) =>
                            toast.error(String(error)),
                          );
                        }}
                      >
                        <OpenExternalIcon /> Logs
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              );
            })}
            {deployment.statuses.length === 0 && (
              <Item>
                <ItemDescription>
                  Waiting for the deployment provider to report a status. This view refreshes
                  automatically.
                </ItemDescription>
              </Item>
            )}
          </ItemGroup>
        </ResourceSection>

        <ResourceSection title="Code Changes">
          <div className="flex-1 min-h-125 border rounded-md overflow-hidden flex flex-col bg-background">
            {diffLoading ? (
              <div className="flex flex-col items-center justify-center p-8 text-subtle-foreground">
                <Spinner />
                <span className="mt-2 text-sm">Fetching commit changes...</span>
              </div>
            ) : diffError ? (
              <div className="p-4">
                <Alert tone="error">
                  <AlertTitle>Could not load diff</AlertTitle>
                  <AlertDescription>{diffError}</AlertDescription>
                  <AlertActions>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFetch}
                      disabled={isFetchingRemote}
                    >
                      {isFetchingRemote ? <Spinner compact className="mr-2" /> : null}
                      Fetch from Remote
                    </Button>
                  </AlertActions>
                </Alert>
              </div>
            ) : multiDiff ? (
              <div className="flex-1 min-h-0 bg-background overflow-hidden relative">
                <GitDiffEditorStack
                  bufferId={`deployment-diff-${deployment.id}`}
                  multiDiff={multiDiff}
                  defaultSidebarOpen={false}
                />
              </div>
            ) : null}
          </div>
        </ResourceSection>
      </div>
    </ResourceSidebarLayout>
  );
}
