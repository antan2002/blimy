interface GitHubPullRequestLink {
  kind: "pullRequest";
  owner: string;
  repo: string;
  number: number;
  url: string;
}

interface GitHubIssueLink {
  kind: "issue";
  owner: string;
  repo: string;
  number: number;
  url: string;
}

interface GitHubActionRunLink {
  kind: "actionRun";
  owner: string;
  repo: string;
  runId: number;
  url: string;
}

interface GitHubCommitLink {
  kind: "commit";
  owner: string;
  repo: string;
  sha: string;
  url: string;
}

export type GitHubEntityLink =
  | GitHubPullRequestLink
  | GitHubIssueLink
  | GitHubActionRunLink
  | GitHubCommitLink;

export function isGitHubEntityLinkForRepository(
  entityLink: GitHubEntityLink,
  repositoryUrl?: string,
): boolean {
  if (!repositoryUrl) return false;

  const repository = parseGitHubRepositoryUrl(repositoryUrl);
  return (
    repository?.owner.toLowerCase() === entityLink.owner.toLowerCase() &&
    repository.repo.toLowerCase() === entityLink.repo.toLowerCase()
  );
}

export function parseGitHubRepositoryUrl(value: string): { owner: string; repo: string } | null {
  const normalized = value.trim();
  const httpsMatch = normalized.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
  );
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  return null;
}

export function parseGitHubEntityLink(value: string): GitHubEntityLink | null {
  try {
    const url = new URL(value);
    if (!isGitHubHost(url.hostname)) return null;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 4) return null;

    const [owner, repo, section, id] = segments;

    if (section === "pull" && isNumericId(id)) {
      return {
        kind: "pullRequest",
        owner,
        repo,
        number: Number(id),
        url: url.toString(),
      };
    }

    if (section === "issues" && isNumericId(id)) {
      return {
        kind: "issue",
        owner,
        repo,
        number: Number(id),
        url: url.toString(),
      };
    }

    if (section === "actions" && segments[3] === "runs" && isNumericId(segments[4])) {
      return {
        kind: "actionRun",
        owner,
        repo,
        runId: Number(segments[4]),
        url: url.toString(),
      };
    }

    if (section === "commit" && isCommitSha(id)) {
      return {
        kind: "commit",
        owner,
        repo,
        sha: id,
        url: url.toString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function parseGitHubCheckSuiteId(value: string): number | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/check-suites\/(\d+)(?:\/|$)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function isGitHubHost(hostname: string): boolean {
  return hostname === "github.com" || hostname === "www.github.com";
}

export function parseSelectedFilePathFromPRBufferPath(path: string): string | null {
  try {
    const url = new URL(path);
    return url.searchParams.get("file");
  } catch {
    return null;
  }
}

export function isPRFilesViewPath(path: string): boolean {
  try {
    const url = new URL(path);
    return url.searchParams.has("file") || url.searchParams.get("view") === "files";
  } catch {
    return false;
  }
}

export function isPRReviewViewPath(path: string): boolean {
  try {
    return new URL(path).searchParams.get("view") === "review";
  } catch {
    return false;
  }
}

export interface PullRequestReference {
  owner: string;
  repo: string;
  number: number;
  /** A repository reference the GitHub commands accept, such as `github://owner/name`. */
  repoPath: string;
}

/**
 * Resolves a typed pull request reference into an openable target. It accepts a
 * full GitHub URL, `owner/repo#123`, or `owner/repo/123`, so a pull request from
 * any repository can be opened without cloning it.
 */
export function parsePullRequestReference(value: string): PullRequestReference | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const link = parseGitHubEntityLink(trimmed);
  if (link?.kind === "pullRequest") {
    return {
      owner: link.owner,
      repo: link.repo,
      number: link.number,
      repoPath: `github://${link.owner}/${link.repo}`,
    };
  }

  const shorthand = trimmed.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)(?:#|\/)(\d+)$/);
  if (shorthand) {
    const [, owner, repo, number] = shorthand;
    return { owner, repo, number: Number(number), repoPath: `github://${owner}/${repo}` };
  }

  return null;
}

export type PRBufferView = "activity" | "files" | "review";

export function buildPRBufferPath(
  prNumber: number,
  selectedFilePath?: string | null,
  view: PRBufferView = selectedFilePath ? "files" : "activity",
): string {
  const base = `pr://${prNumber}`;
  if (selectedFilePath) return `${base}?file=${encodeURIComponent(selectedFilePath)}`;
  return view === "activity" ? base : `${base}?view=${view}`;
}

function isNumericId(value: string | undefined): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function isCommitSha(value: string | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{7,64}$/i.test(value);
}

/**
 * Reduces any github.com entity URL (pull, issue, run, commit, tree) to the
 * repository URL it belongs to.
 */
export function getRepositoryUrlFromEntityUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!isGitHubHost(url.hostname)) return null;
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    return `https://github.com/${owner}/${repo.replace(/\.git$/, "")}`;
  } catch {
    return null;
  }
}

function joinRepositoryUrl(repositoryUrl: string, path: string): string {
  return `${repositoryUrl.replace(/\/+$/, "")}/${path}`;
}

export function getGitHubUserUrl(login: string): string {
  return `https://github.com/${encodeURIComponent(login)}`;
}

export function getGitHubBranchUrl(repositoryUrl: string, branch: string): string {
  return joinRepositoryUrl(
    repositoryUrl,
    `tree/${branch.split("/").map(encodeURIComponent).join("/")}`,
  );
}

export function getGitHubCommitUrl(repositoryUrl: string, sha: string): string {
  return joinRepositoryUrl(repositoryUrl, `commit/${sha}`);
}

export function getGitHubLabelUrl(
  repositoryUrl: string,
  label: string,
  kind: "issues" | "pulls" = "issues",
): string {
  return joinRepositoryUrl(
    repositoryUrl,
    `${kind}?q=${encodeURIComponent(`is:open label:"${label}"`)}`,
  );
}

export function getGitHubMilestoneUrl(repositoryUrl: string, milestoneNumber: number): string {
  return joinRepositoryUrl(repositoryUrl, `milestone/${milestoneNumber}`);
}

export function getGitHubWorkflowRunsUrl(repositoryUrl: string, workflowName: string): string {
  return joinRepositoryUrl(
    repositoryUrl,
    `actions?query=${encodeURIComponent(`workflow:"${workflowName}"`)}`,
  );
}

export function getGitHubCompareUrl(
  repositoryUrl: string,
  baseRef: string,
  headRef: string,
): string {
  return joinRepositoryUrl(
    repositoryUrl,
    `compare/${encodeURIComponent(baseRef)}...${encodeURIComponent(headRef)}`,
  );
}
