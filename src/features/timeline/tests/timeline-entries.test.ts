import { describe, expect, it } from "vite-plus/test";
import type { GitCommit } from "@/features/git/types/git.types";
import type { LocalHistoryEntry } from "@/features/local-history/api/local-history-api";
import {
  commitTimestamp,
  describeTimelineEntry,
  groupTimelineByDay,
  mergeTimelineEntries,
} from "@/features/timeline/utils/timeline-entries";

function commit(hash: string, date: string): GitCommit {
  return {
    hash,
    message: `Commit ${hash}`,
    description: undefined,
    author: "Blimy",
    email: "blimy@example.com",
    date,
  };
}

function snapshot(id: string, createdAt: number): LocalHistoryEntry {
  return {
    id,
    file_path: "/repo/file.ts",
    file_name: "file.ts",
    created_at: createdAt,
    size: 10,
    content_hash: "hash",
    reason: "save",
    label: null,
  };
}

describe("commit timestamps", () => {
  it("anchors a day-only commit to the end of that day", () => {
    const endOfDay = Date.parse("2026-01-02T23:59:59");
    expect(commitTimestamp("2026-01-02")).toBe(endOfDay);
  });

  it("reports no time for a date it cannot parse", () => {
    expect(commitTimestamp("not a date")).toBe(0);
    expect(commitTimestamp("")).toBe(0);
  });
});

describe("timeline entry ordering", () => {
  it("puts the newest entry first", () => {
    const entries = mergeTimelineEntries(
      [commit("aaa", "2026-01-01"), commit("bbb", "2026-01-03")],
      [snapshot("snap", Date.parse("2026-01-02T10:00:00"))],
    );

    expect(entries.map((entry) => entry.id)).toEqual([
      "commit:bbb",
      "snapshot:snap",
      "commit:aaa",
    ]);
  });

  it("sorts a day-only commit above an earlier snapshot from that day", () => {
    // Git reports no time of day, so the commit is anchored to the end of its
    // day. A morning snapshot is therefore older, which is the convention the
    // rest of the timeline reads by.
    const morning = Date.parse("2026-01-02T08:00:00");
    const entries = mergeTimelineEntries([commit("day", "2026-01-02")], [snapshot("morning", morning)]);

    expect(entries.map((entry) => entry.id)).toEqual(["commit:day", "snapshot:morning"]);
  });

  it("keeps commits in git order within the same day", () => {
    const entries = mergeTimelineEntries(
      [commit("first", "2026-01-02"), commit("second", "2026-01-02")],
      [],
    );

    // Equal timestamps keep the order git returned, newest first.
    expect(entries.map((entry) => entry.id)).toEqual(["commit:first", "commit:second"]);
  });

  it("places a same-day commit above every snapshot from that day", () => {
    // End-of-day anchoring is a total order within a day, so even a snapshot
    // taken at 23:30 sorts below the commit. That is the cost of not knowing a
    // commit's time, and it is the same trade VS Code makes.
    const lateEvening = Date.parse("2026-01-02T23:30:00");
    const entries = mergeTimelineEntries([commit("day", "2026-01-02")], [snapshot("late", lateEvening)]);

    expect(entries.map((entry) => entry.id)).toEqual(["commit:day", "snapshot:late"]);
  });

  it("orders a next-day snapshot above a same-day commit", () => {
    const nextMorning = Date.parse("2026-01-03T00:30:00");
    const entries = mergeTimelineEntries([commit("day", "2026-01-02")], [snapshot("next", nextMorning)]);

    expect(entries.map((entry) => entry.id)).toEqual(["snapshot:next", "commit:day"]);
  });
});

describe("timeline day grouping", () => {
  it("groups entries that fall on the same calendar day", () => {
    const morning = Date.parse("2026-01-02T08:00:00");
    const evening = Date.parse("2026-01-02T20:00:00");
    const nextDay = Date.parse("2026-01-03T08:00:00");

    // The merged list is newest first, so the later day is the first group.
    const groups = groupTimelineByDay(
      mergeTimelineEntries(
        [],
        [snapshot("a", morning), snapshot("b", evening), snapshot("c", nextDay)],
      ),
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["snapshot:c"]);
    expect(groups[1].entries.map((entry) => entry.id)).toEqual(["snapshot:b", "snapshot:a"]);
  });

  it("returns nothing for an empty timeline", () => {
    expect(groupTimelineByDay([])).toEqual([]);
  });
});

describe("timeline entry descriptions", () => {
  it("describes a commit by author and short hash", () => {
    const entry = describeTimelineEntry(
      mergeTimelineEntries([commit("abcdef1234", "2026-01-02")], [])[0],
    );

    expect(entry.title).toBe("Commit abcdef1234");
    expect(entry.description).toBe("Blimy committed abcdef1");
  });

  it("falls back when a commit has no message", () => {
    const entry = describeTimelineEntry(
      mergeTimelineEntries([{ ...commit("abc1234", "2026-01-02"), message: "" }], [])[0],
    );

    expect(entry.title).toBe("No commit message");
  });

  it("uses a snapshot label when one exists", () => {
    const entry = describeTimelineEntry(
      mergeTimelineEntries(
        [],
        [{ ...snapshot("s1", Date.parse("2026-01-02T08:00:00")), label: "Before refactor" }],
      )[0],
    );

    expect(entry.title).toBe("Before refactor");
    expect(entry.description).toBe("Saved locally");
  });

  it("names an unlabelled snapshot", () => {
    const entry = describeTimelineEntry(
      mergeTimelineEntries([], [snapshot("s1", Date.parse("2026-01-02T08:00:00"))])[0],
    );

    expect(entry.title).toBe("Local snapshot");
  });

  it("names an unusual snapshot reason", () => {
    const entry = describeTimelineEntry(
      mergeTimelineEntries(
        [],
        [{ ...snapshot("s1", Date.parse("2026-01-02T08:00:00")), reason: "restore" }],
      )[0],
    );

    expect(entry.description).toBe("Saved locally (restore)");
  });
});
