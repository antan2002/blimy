import type { GitCommit } from "@/features/git/types/git.types";
import type { LocalHistoryEntry } from "@/features/local-history/api/local-history-api";

/**
 * One row in the file timeline. Git commits and local snapshots come from
 * different sources with different shapes and different precision, so they are
 * normalised here rather than in the component.
 */
export type TimelineEntry =
  | { kind: "commit"; id: string; at: number; commit: GitCommit }
  | { kind: "snapshot"; id: string; at: number; snapshot: LocalHistoryEntry };

const GIT_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `git_log` reports a day, not a time, so a commit is anchored to the end of
 * its day. Anchoring to midnight instead would sort a commit above snapshots
 * taken later that same day, which is a larger lie than the one this makes:
 * within a day, the commit is treated as the latest known event.
 */
export function commitTimestamp(date: string): number {
  if (!GIT_DATE_ONLY.test(date)) return 0;
  const parsed = Date.parse(`${date}T23:59:59`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function mergeTimelineEntries(
  commits: GitCommit[],
  snapshots: LocalHistoryEntry[],
): TimelineEntry[] {
  const merged: TimelineEntry[] = [
    ...commits.map((commit) => ({
      kind: "commit" as const,
      id: `commit:${commit.hash}`,
      at: commitTimestamp(commit.date),
      commit,
    })),
    ...snapshots.map((snapshot) => ({
      kind: "snapshot" as const,
      id: `snapshot:${snapshot.id}`,
      // `created_at` is already epoch milliseconds.
      at: snapshot.created_at,
      snapshot,
    })),
  ];

  return merged.sort((left, right) => right.at - left.at);
}

export interface TimelineDayGroup {
  day: string;
  entries: TimelineEntry[];
}

/** Groups consecutive entries that fall on the same calendar day. */
export function groupTimelineByDay(entries: TimelineEntry[]): TimelineDayGroup[] {
  const groups: TimelineDayGroup[] = [];

  for (const entry of entries) {
    const day = new Date(entry.at).toDateString();
    const last = groups[groups.length - 1];

    if (last && last.day === day) {
      last.entries.push(entry);
    } else {
      groups.push({ day, entries: [entry] });
    }
  }

  return groups;
}

export function describeTimelineEntry(entry: TimelineEntry): {
  title: string;
  description: string;
} {
  if (entry.kind === "commit") {
    return {
      title: entry.commit.message || "No commit message",
      description: `${entry.commit.author} committed ${entry.commit.hash.slice(0, 7)}`,
    };
  }

  return {
    title: entry.snapshot.label?.trim() || "Local snapshot",
    description:
      entry.snapshot.reason === "save" || entry.snapshot.reason === "auto-save"
        ? "Saved locally"
        : `Saved locally (${entry.snapshot.reason})`,
  };
}
