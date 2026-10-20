import { describe, expect, it } from "vite-plus/test";

import { parsePullRequestReview } from "@/features/ai/pr-review/pr-review-report";

const files = ["src/app.ts", "src/lib/util.ts"];

describe("parsePullRequestReview", () => {
  it("parses a fenced JSON object and maps severities", () => {
    const reply = [
      "```json",
      JSON.stringify({
        verdict: "request_changes",
        summary: "A caching bug.",
        findings: [
          {
            severity: "error",
            category: "Bug",
            file: "src/app.ts",
            line: 12,
            endLine: 14,
            title: "Stale cache",
            body: "Never invalidated.",
            suggestion: "- cache = null",
          },
        ],
      }),
      "```",
    ].join("\n");
    const result = parsePullRequestReview(reply, files);

    expect(result.verdict).toBe("request_changes");
    expect(result.summary).toBe("A caching bug.");
    expect(result.findings).toEqual([
      {
        severity: "critical",
        category: "bug",
        file: "src/app.ts",
        line: 12,
        endLine: 14,
        title: "Stale cache",
        body: "Never invalidated.",
        suggestion: "- cache = null",
      },
    ]);
  });

  it("drops findings that point at files outside the diff", () => {
    const reply = JSON.stringify({
      findings: [{ severity: "warning", file: "src/other.ts", line: 1, title: "T", body: "B" }],
    });

    expect(parsePullRequestReview(reply, files).findings).toEqual([]);
  });

  it("defaults the verdict from the findings and survives junk", () => {
    const reply = JSON.stringify({
      findings: [{ severity: "suggestion", file: "src/app.ts", line: 3, title: "T", body: "B" }],
    });

    expect(parsePullRequestReview(reply, files).verdict).toBe("request_changes");
    expect(parsePullRequestReview("not json", files)).toEqual({
      summary: "",
      verdict: "comment",
      findings: [],
    });
  });
});
