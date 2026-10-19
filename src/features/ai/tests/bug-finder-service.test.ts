import { describe, expect, it, vi } from "vitest";

import { BUG_FINDER_OWNER } from "@/features/ai/bug-finder/bug-finder-review";
import {
  createBugFinderService,
  countLines,
  formatGitDiffForReview,
  isReviewableFile,
  type BugFinderModelRequest,
} from "@/features/ai/bug-finder/bug-finder-service";
import type { GitDiff } from "@/features/git/types/git.types";

const diff = (overrides: Partial<GitDiff> = {}): GitDiff => ({
  file_path: "src/app.ts",
  is_new: false,
  is_deleted: false,
  is_renamed: false,
  lines: [
    { line_type: "header", content: "@@ -1 +1 @@" },
    { line_type: "removed", content: "const a = 1;" },
    { line_type: "added", content: "const a = undefined;" },
  ],
  ...overrides,
});

function setup(options: {
  enabled?: boolean;
  fileDiff?: GitDiff | null;
  reply?: string;
  ignored?: boolean;
  throws?: boolean;
}) {
  const setDiagnostics = vi.fn();
  const onError = vi.fn();
  const callModel = vi.fn<(request: BugFinderModelRequest) => Promise<string>>(async () => {
    if (options.throws) {
      throw new Error("provider offline");
    }

    return options.reply ?? "[]";
  });
  const getFileDiff = vi.fn(async () =>
    options.fileDiff === undefined ? diff() : options.fileDiff,
  );

  const service = createBugFinderService({
    callModel,
    getFileDiff,
    setDiagnostics,
    isEnabled: () => options.enabled ?? true,
    isIgnored: () => options.ignored ?? false,
    onError,
  });

  return { service, callModel, getFileDiff, setDiagnostics, onError };
}

describe("isReviewableFile", () => {
  it("accepts source files", () => {
    expect(isReviewableFile("src/app.tsx")).toBe(true);
    expect(isReviewableFile("crates/ai/src/lib.rs")).toBe(true);
    expect(isReviewableFile("C:\\repo\\main.PY")).toBe(true);
  });

  it("rejects non-source files and extensionless names", () => {
    expect(isReviewableFile("README.md")).toBe(false);
    expect(isReviewableFile("package.json")).toBe(false);
    expect(isReviewableFile("Makefile")).toBe(false);
    expect(isReviewableFile("assets/logo.png")).toBe(false);
  });
});

describe("countLines", () => {
  it("counts lines and treats empty content as no lines", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a")).toBe(1);
    expect(countLines("a\nb\nc")).toBe(3);
  });
});

describe("formatGitDiffForReview", () => {
  it("prefers the raw patch", () => {
    expect(formatGitDiffForReview(diff({ raw_patch: "@@ -1 +1 @@\n-x\n+y" }))).toBe(
      "@@ -1 +1 @@\n-x\n+y",
    );
  });

  it("rebuilds a patch when the raw patch is missing", () => {
    expect(formatGitDiffForReview(diff())).toBe(
      " @@ -1 +1 @@\n-const a = 1;\n+const a = undefined;",
    );
  });
});

describe("createBugFinderService", () => {
  it("reviews a saved file and publishes diagnostics under its own owner", async () => {
    const { service, callModel, setDiagnostics } = setup({
      reply: '[{"line": 2, "severity": "error", "message": "Assigns undefined."}]',
    });

    const findings = await service.reviewFile({
      filePath: "src/app.ts",
      content: "const a = 1;\nconst b = undefined;",
    });

    expect(findings).toHaveLength(1);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(setDiagnostics).toHaveBeenCalledWith(
      "src/app.ts",
      [
        {
          severity: "error",
          filePath: "src/app.ts",
          line: 1,
          column: 0,
          endLine: 1,
          endColumn: 0,
          message: "Assigns undefined.",
          source: "bug-finder",
          owner: BUG_FINDER_OWNER,
        },
      ],
      BUG_FINDER_OWNER,
    );
  });

  it("sends the system prompt and the diff", async () => {
    const { service, callModel } = setup({ reply: "[]" });

    await service.reviewFile({ filePath: "src/app.ts", content: "const a = 1;" });

    const request = callModel.mock.calls[0]?.[0];

    expect(request?.systemPrompt).toContain("JSON array");
    expect(request?.prompt).toContain("File: src/app.ts");
    expect(request?.prompt).toContain("+const a = undefined;");
  });

  it("does nothing when the feature is disabled", async () => {
    const { service, callModel, setDiagnostics } = setup({ enabled: false });

    await expect(
      service.reviewFile({ filePath: "src/app.ts", content: "const a = 1;" }),
    ).resolves.toEqual([]);
    expect(callModel).not.toHaveBeenCalled();
    expect(setDiagnostics).not.toHaveBeenCalled();
  });

  it("skips files that are not reviewable", async () => {
    const { service, callModel, getFileDiff } = setup({});

    await expect(service.reviewFile({ filePath: "README.md", content: "# hi" })).resolves.toEqual(
      [],
    );
    expect(getFileDiff).not.toHaveBeenCalled();
    expect(callModel).not.toHaveBeenCalled();
  });

  it("clears diagnostics for ignored files", async () => {
    const { service, setDiagnostics, callModel } = setup({ ignored: true });

    await service.reviewFile({ filePath: "src/app.ts", content: "const a = 1;" });

    expect(setDiagnostics).toHaveBeenCalledWith("src/app.ts", [], BUG_FINDER_OWNER);
    expect(callModel).not.toHaveBeenCalled();
  });

  it("skips empty buffers", async () => {
    const { service, getFileDiff } = setup({});

    await expect(service.reviewFile({ filePath: "src/app.ts", content: "" })).resolves.toEqual([]);
    expect(getFileDiff).not.toHaveBeenCalled();
  });

  it("clears stale markers when there is no diff to review", async () => {
    const { service, setDiagnostics, callModel } = setup({ fileDiff: null });

    await service.reviewFile({ filePath: "src/app.ts", content: "const a = 1;" });

    expect(setDiagnostics).toHaveBeenCalledWith("src/app.ts", [], BUG_FINDER_OWNER);
    expect(callModel).not.toHaveBeenCalled();
  });

  it("ignores binary and deleted files", async () => {
    const binary = setup({ fileDiff: diff({ is_binary: true }) });

    await binary.service.reviewFile({
      filePath: "src/app.ts",
      content: "x",
    });
    expect(binary.callModel).not.toHaveBeenCalled();

    const deleted = setup({ fileDiff: diff({ is_deleted: true }) });

    await deleted.service.reviewFile({
      filePath: "src/app.ts",
      content: "x",
    });
    expect(deleted.callModel).not.toHaveBeenCalled();
  });

  it("clears markers when the review finds no bugs", async () => {
    const { service, setDiagnostics } = setup({ reply: "```json\n[]\n```" });

    await expect(
      service.reviewFile({ filePath: "src/app.ts", content: "const a = 1;" }),
    ).resolves.toEqual([]);
    expect(setDiagnostics).toHaveBeenCalledWith("src/app.ts", [], BUG_FINDER_OWNER);
  });

  it("reports model failures without throwing", async () => {
    const { service, onError, setDiagnostics } = setup({ throws: true });

    await expect(
      service.reviewFile({ filePath: "src/app.ts", content: "const a = 1;" }),
    ).resolves.toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(setDiagnostics).toHaveBeenCalledWith("src/app.ts", [], BUG_FINDER_OWNER);
  });

  it("drops a reply that is not JSON", async () => {
    const { service, setDiagnostics } = setup({ reply: "Looks fine to me." });

    await expect(
      service.reviewFile({ filePath: "src/app.ts", content: "const a = 1;" }),
    ).resolves.toEqual([]);
    expect(setDiagnostics).toHaveBeenCalledWith("src/app.ts", [], BUG_FINDER_OWNER);
  });

  it("skips a second review while the first is still running", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const setDiagnostics = vi.fn();
    const callModel = vi.fn(async () => {
      await gate;
      return "[]";
    });
    const service = createBugFinderService({
      callModel,
      getFileDiff: async () => diff(),
      setDiagnostics,
      isEnabled: () => true,
    });

    const first = service.reviewFile({
      filePath: "src/app.ts",
      content: "const a = 1;",
    });

    expect(service.isReviewing("src/app.ts")).toBe(true);

    const second = await service.reviewFile({
      filePath: "src/app.ts",
      content: "const a = 1;",
    });

    expect(second).toEqual([]);
    expect(callModel).toHaveBeenCalledTimes(1);

    release?.();
    await first;

    expect(service.isReviewing("src/app.ts")).toBe(false);
  });

  it("clears diagnostics on demand", () => {
    const { service, setDiagnostics } = setup({});

    service.clear("src/app.ts");

    expect(setDiagnostics).toHaveBeenCalledWith("src/app.ts", [], BUG_FINDER_OWNER);
  });
});
