import { describe, expect, it } from "vite-plus/test";
import {
  compileAiIgnorePattern,
  createAiIgnoreMatcherFromContents,
  loadAiIgnore,
  parseAiIgnorePatterns,
} from "@/features/ai/lib/ai-ignore";
import type { AiIgnoreReader } from "@/features/ai/types/ai-ignore.types";

function memoryReader(files: Record<string, string>): AiIgnoreReader {
  return {
    async readDirectory(path) {
      const prefix = `${path.replace(/\/$/, "")}/`;
      const names = new Set<string>();
      for (const filePath of Object.keys(files)) {
        if (!filePath.startsWith(prefix)) continue;
        const rest = filePath.slice(prefix.length);
        if (!rest.includes("/")) names.add(rest);
      }
      if (names.size === 0) throw new Error(`No such directory: ${path}`);
      return Array.from(names).map((name) => ({ name, path: `${prefix}${name}`, isDir: false }));
    },
    async readText(path) {
      const content = files[path];
      if (content === undefined) throw new Error(`No such file: ${path}`);
      return content;
    },
  };
}

const matches = (content: string, path: string) =>
  createAiIgnoreMatcherFromContents([content])(path);

describe("ai ignore patterns", () => {
  it("skips comments, blanks and a lone slash", () => {
    expect(compileAiIgnorePattern("# secrets")).toBeNull();
    expect(compileAiIgnorePattern("   ")).toBeNull();
    expect(compileAiIgnorePattern("/")).toBeNull();
    expect(compileAiIgnorePattern("dist/")?.source).toBe("dist");
    expect(compileAiIgnorePattern("!keep.txt")?.negated).toBe(true);
    expect(parseAiIgnorePatterns("a\n# b\n\nc")).toHaveLength(2);
  });

  it("matches a bare name at any depth", () => {
    expect(matches("node_modules", "node_modules/react/index.js")).toBe(true);
    expect(matches("*.log", "logs/app.log")).toBe(true);
    expect(matches("*.log", "src/app.ts")).toBe(false);
    expect(matches("secret.txt", "a/b/secret.txt")).toBe(true);
  });

  it("anchors a leading slash or an inner slash to the root", () => {
    expect(matches("/build", "build/a.js")).toBe(true);
    expect(matches("/build", "app/build/a.js")).toBe(false);
    expect(matches("src/generated", "src/generated/x.ts")).toBe(true);
    expect(matches("src/generated", "lib/src/generated/x.ts")).toBe(false);
  });

  it("spans directories with ** and keeps * inside a segment", () => {
    expect(matches("src/**/*.spec.ts", "src/a/b/c.spec.ts")).toBe(true);
    expect(matches("src/**/*.spec.ts", "src/c.spec.ts")).toBe(true);
    expect(matches("src/*/*.ts", "src/a/b/x.ts")).toBe(false);
    expect(matches("docs/**", "docs/guide/intro.md")).toBe(true);
  });

  it("lets a later negation re-include a path", () => {
    const matcher = createAiIgnoreMatcherFromContents(["*.env", "!sample.env"]);
    expect(matcher("app.env")).toBe(true);
    expect(matcher("sample.env")).toBe(false);
  });

  it("excludes the contents of an ignored directory", () => {
    expect(matches("coverage/", "coverage/lcov.info")).toBe(true);
    expect(matches("tmp/", "tmp")).toBe(true);
  });
});

describe("loading ai ignore files", () => {
  it("reads both ignore files and lets the later one override", async () => {
    const loaded = await loadAiIgnore(
      "/w",
      memoryReader({
        "/w/.cursorignore": "dist/\n*.log",
        "/w/.blimyignore": "!important.log",
      }),
    );
    expect(loaded.files).toEqual([".cursorignore", ".blimyignore"]);
    expect(loaded.matcher("dist/bundle.js")).toBe(true);
    expect(loaded.matcher("app.log")).toBe(true);
    expect(loaded.matcher("important.log")).toBe(false);
  });

  it("returns an empty matcher when no ignore file exists", async () => {
    const loaded = await loadAiIgnore("/w", memoryReader({ "/w/src/a.ts": "x" }));
    expect(loaded.files).toEqual([]);
    expect(loaded.matcher("anything/at/all.ts")).toBe(false);
  });

  it("never throws when the project cannot be read", async () => {
    const loaded = await loadAiIgnore("/missing", {
      readDirectory: async () => {
        throw new Error("nope");
      },
      readText: async () => {
        throw new Error("nope");
      },
    });
    expect(loaded.patterns).toEqual([]);
    expect(loaded.matcher("a/b")).toBe(false);
  });
});
