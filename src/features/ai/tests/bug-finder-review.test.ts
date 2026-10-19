import { describe, expect, it } from "vitest";

import {
  BUG_FINDER_SOURCE,
  MAX_BUG_DIFF_CHARS,
  MAX_BUG_FINDINGS,
  buildBugFinderPrompt,
  parseBugFinderFindings,
  toBugDiagnostics,
} from "@/features/ai/bug-finder/bug-finder-review";

describe("parseBugFinderFindings", () => {
  it("parses a plain JSON array", () => {
    const findings = parseBugFinderFindings(
      '[{"line": 3, "severity": "error", "message": "Leaks the handle."}]',
      10,
    );

    expect(findings).toEqual([
      { line: 3, endLine: 3, severity: "error", message: "Leaks the handle." },
    ]);
  });

  it("parses fenced JSON and surrounding prose", () => {
    const reply = [
      "Here are the bugs:",
      "```json",
      '[{"line": 2, "endLine": 4, "severity": "warning", "message": "Unchecked result."}]',
      "```",
    ].join("\n");

    expect(parseBugFinderFindings(reply, 10)).toEqual([
      {
        line: 2,
        endLine: 4,
        severity: "warning",
        message: "Unchecked result.",
      },
    ]);
  });

  it("accepts an object that wraps the array", () => {
    const reply = '{"bugs": [{"line": 1, "message": "Null deref."}]}';

    expect(parseBugFinderFindings(reply, 5)).toEqual([
      { line: 1, endLine: 1, severity: "warning", message: "Null deref." },
    ]);
  });

  it("returns an empty array when the model reports no bugs", () => {
    expect(parseBugFinderFindings("[]", 5)).toEqual([]);
    expect(parseBugFinderFindings("```json\n[]\n```", 5)).toEqual([]);
  });

  it("returns an empty array for unusable replies", () => {
    expect(parseBugFinderFindings("", 5)).toEqual([]);
    expect(parseBugFinderFindings("I could not review this.", 5)).toEqual([]);
    expect(parseBugFinderFindings("[not json]", 5)).toEqual([]);
    expect(parseBugFinderFindings('[{"line": 1}]', 5)).toEqual([]);
  });

  it("drops entries with a missing line or message", () => {
    const reply = '[{"message": "No line."}, {"line": 2}, {"line": 2, "message": "Kept."}]';

    expect(parseBugFinderFindings(reply, 5)).toEqual([
      { line: 2, endLine: 2, severity: "warning", message: "Kept." },
    ]);
  });

  it("accepts numeric strings for lines", () => {
    expect(parseBugFinderFindings('[{"line": "4", "message": "Off by one."}]', 5)).toEqual([
      { line: 4, endLine: 4, severity: "warning", message: "Off by one." },
    ]);
  });

  it("clamps line numbers into the file range", () => {
    const reply = '[{"line": 0, "message": "Too low."}, {"line": 900, "message": "Too high."}]';

    expect(parseBugFinderFindings(reply, 12)).toEqual([
      { line: 1, endLine: 1, severity: "warning", message: "Too low." },
      { line: 12, endLine: 12, severity: "warning", message: "Too high." },
    ]);
  });

  it("never reports an endLine before the line", () => {
    const reply = '[{"line": 6, "endLine": 2, "message": "Backwards range."}]';

    expect(parseBugFinderFindings(reply, 10)).toEqual([
      { line: 6, endLine: 6, severity: "warning", message: "Backwards range." },
    ]);
  });

  it("normalises severity names and defaults unknown ones to warning", () => {
    const reply = [
      "[",
      '{"line": 1, "severity": "BUG", "message": "a"},',
      '{"line": 2, "severity": "Critical", "message": "b"},',
      '{"line": 3, "severity": "warn", "message": "c"},',
      '{"line": 4, "severity": "nit", "message": "d"},',
      '{"line": 5, "severity": "banana", "message": "e"},',
      '{"line": 6, "message": "f"}',
      "]",
    ].join("");

    expect(parseBugFinderFindings(reply, 10).map((f) => f.severity)).toEqual([
      "error",
      "error",
      "warning",
      "info",
      "warning",
      "warning",
    ]);
  });

  it("dedupes identical findings and caps the list", () => {
    const duplicate = '[{"line": 2, "message": "Same."}, {"line": 2, "message": "Same."}]';

    expect(parseBugFinderFindings(duplicate, 10)).toHaveLength(1);

    const many = Array.from(
      { length: MAX_BUG_FINDINGS + 5 },
      (_, index) => `{"line": ${index + 1}, "message": "Bug ${index}."}`,
    ).join(",");

    expect(parseBugFinderFindings(`[${many}]`, 100)).toHaveLength(MAX_BUG_FINDINGS);
  });

  it("rejects a non-positive line count", () => {
    expect(parseBugFinderFindings('[{"line": 1, "message": "x"}]', 0)).toEqual([]);
  });
});

describe("buildBugFinderPrompt", () => {
  it("includes the file path and the diff in a diff block", () => {
    const prompt = buildBugFinderPrompt({
      filePath: "src/app.ts",
      diff: "@@ -1 +1 @@\n-const a = 1;\n+const a = 2;",
    });

    expect(prompt).toContain("File: src/app.ts");
    expect(prompt).toContain("```diff");
    expect(prompt).toContain("+const a = 2;");
  });

  it("truncates very large diffs", () => {
    const prompt = buildBugFinderPrompt({
      filePath: "src/big.ts",
      diff: "x".repeat(MAX_BUG_DIFF_CHARS + 1000),
    });

    expect(prompt).toContain("(diff truncated)");
    expect(prompt.length).toBeLessThan(MAX_BUG_DIFF_CHARS + 1000);
  });
});

describe("toBugDiagnostics", () => {
  it("converts 1-based findings into 0-based diagnostics", () => {
    const diagnostics = toBugDiagnostics("src/app.ts", [
      { line: 3, endLine: 4, severity: "error", message: "Crash." },
    ]);

    expect(diagnostics).toEqual([
      {
        severity: "error",
        filePath: "src/app.ts",
        line: 2,
        column: 0,
        endLine: 3,
        endColumn: 0,
        message: "Crash.",
        source: BUG_FINDER_SOURCE,
        owner: "bug-finder",
      },
    ]);
  });

  it("returns an empty list for no findings", () => {
    expect(toBugDiagnostics("src/app.ts", [])).toEqual([]);
  });
});
