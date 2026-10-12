import { describe, expect, it } from "vite-plus/test";
import { buildContextPrompt, buildSystemPrompt } from "@/features/ai/utils/ai-context-builder";

describe("AI context builder", () => {
  it("includes selected editor text with its file location", () => {
    const prompt = buildContextPrompt({
      projectRoot: "/workspace",
      editorSelections: [
        {
          id: "selection-1",
          bufferId: "buffer-1",
          filePath: "/workspace/src/app.ts",
          fileName: "app.ts",
          languageId: "typescript",
          selectedText: "const answer = 42;",
          startLine: 4,
          startColumn: 1,
          endLine: 4,
          endColumn: 19,
        },
      ],
    });

    expect(prompt).toContain("Selected editor context:");
    expect(prompt).toContain("src/app.ts:4");
    expect(prompt).toContain("```typescript\nconst answer = 42;\n```");
  });

  it("names the built-in agent's real workspace tools", () => {
    const prompt = buildSystemPrompt("");

    expect(prompt).toContain("read_file");
    expect(prompt).toContain("list_files");
    expect(prompt).toContain("search_files");
    expect(prompt).toContain("write_file");
    expect(prompt).toContain("todo_write");
    expect(prompt).not.toMatch(/\bRead tool\b|\bGlob\b/);
  });

  it("tells the agent to seek the web for time-sensitive questions", () => {
    const prompt = buildSystemPrompt("", "chat");

    expect(prompt).toContain("web_search");
    expect(prompt).toContain("fetch_url");
    expect(prompt).toContain("call web_search before answering");
    expect(prompt).toContain("instead of reasoning from memory");
  });
});
