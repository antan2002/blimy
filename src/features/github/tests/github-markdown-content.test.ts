import { describe, expect, it, vi } from "vite-plus/test";
import { parseMarkdown } from "@/features/editor/markdown/parser";
import { normalizeGitHubMarkdown } from "../utils/github-markdown-content";

vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => html,
  },
}));

describe("normalizeGitHubMarkdown", () => {
  const repositoryUrl = "https://github.com/blimydev/blimy";

  it("autolinks bare URLs and shortens same-repository entity links", () => {
    expect(
      normalizeGitHubMarkdown(
        "Tracked in https://github.com/blimydev/blimy/actions/runs/42.",
        repositoryUrl,
      ),
    ).toBe(
      "Tracked in [https://github.com/blimydev/blimy/actions/runs/42](https://github.com/blimydev/blimy/actions/runs/42).",
    );
    expect(
      normalizeGitHubMarkdown(
        "See https://github.com/blimydev/blimy/pull/734, thanks",
        repositoryUrl,
      ),
    ).toBe("See [#734](https://github.com/blimydev/blimy/pull/734), thanks");
    expect(
      normalizeGitHubMarkdown(
        "Fixed in https://github.com/blimydev/blimy/commit/bb423c6a1b2c3d4e5f60718293a4b5c6d7e8f901",
        repositoryUrl,
      ),
    ).toBe(
      "Fixed in [bb423c6](https://github.com/blimydev/blimy/commit/bb423c6a1b2c3d4e5f60718293a4b5c6d7e8f901)",
    );
    expect(
      normalizeGitHubMarkdown("Other repo https://github.com/foo/bar/pull/1", repositoryUrl),
    ).toBe("Other repo [https://github.com/foo/bar/pull/1](https://github.com/foo/bar/pull/1)");
    expect(normalizeGitHubMarkdown("(see https://example.com/docs)", repositoryUrl)).toBe(
      "(see [https://example.com/docs](https://example.com/docs))",
    );
    expect(normalizeGitHubMarkdown("[already](https://example.com) and `https://in.code`")).toBe(
      "[already](https://example.com) and `https://in.code`",
    );
    expect(normalizeGitHubMarkdown("<https://example.com>")).toBe("<https://example.com>");
  });

  it("renders standalone GitHub attachments as inline video", () => {
    const attachmentUrl =
      "https://github.com/user-attachments/assets/01234567-89ab-cdef-0123-456789abcdef";

    const normalized = normalizeGitHubMarkdown(`Before\n\n${attachmentUrl}`, repositoryUrl);

    expect(normalized).toContain(
      `<video class="github-markdown-attachment" src="${attachmentUrl}" controls preload="metadata" playsinline>`,
    );
    expect(parseMarkdown(normalized)).toContain(
      `<video class="github-markdown-attachment" src="${attachmentUrl}" controls preload="metadata" playsinline>`,
    );
  });

  it("preserves uploaded images already expressed as Markdown", () => {
    const image =
      "![Before](https://github.com/user-attachments/assets/01234567-89ab-cdef-0123-456789abcdef)";

    expect(normalizeGitHubMarkdown(image, repositoryUrl)).toBe(image);
  });

  it("links issue references without rewriting code or existing links", () => {
    const content = [
      "Fixes #714 and keeps `#715` literal.",
      "[Existing #716](https://github.com/blimydev/blimy/issues/716)",
      "```text",
      "#717",
      "```",
    ].join("\n");

    const normalized = normalizeGitHubMarkdown(content, repositoryUrl);

    expect(normalized).toContain(
      "Fixes [#714](https://github.com/blimydev/blimy/issues/714) and keeps `#715` literal.",
    );
    expect(normalized).toContain("[Existing #716](https://github.com/blimydev/blimy/issues/716)");
    expect(normalized).toContain("```text\n#717\n```");
  });

  it("links cross-repository references to the referenced repository", () => {
    expect(normalizeGitHubMarkdown("See blimydev/www#42", repositoryUrl)).toBe(
      "See [blimydev/www#42](https://github.com/blimydev/www/issues/42)",
    );
  });

  it("links malformed attachment paths instead of embedding them", () => {
    const nestedAttachment = "https://github.com/user-attachments/assets/01234567/preview";

    expect(normalizeGitHubMarkdown(nestedAttachment, repositoryUrl)).toBe(
      `[${nestedAttachment}](${nestedAttachment})`,
    );
  });
});
