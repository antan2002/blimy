import { describe, expect, it } from "vitest";
import { normalizeTerminalTitle } from "@/features/terminal/utils/terminal-title";

describe("normalizeTerminalTitle", () => {
  it("normalizes a plain shell title", () => {
    expect(normalizeTerminalTitle("  bun dev  ")).toBe("bun dev");
  });

  it("rejects a title containing ANSI control sequences", () => {
    expect(normalizeTerminalTitle("\u001b[31mmain\u001b[0m")).toBeNull();
  });

  it("rejects a malformed title containing leaked prompt output", () => {
    const title =
      "\ufffd[0m\ufffd[27m\ufffd[24m\ufffd[J\ufffd[01;32mâžœ \ufffd[36mblimy\ufffd[00m " +
      "\ufffd[01;34mgit:(\ufffd[31mmain\ufffd[34m) \ufffd[33mâœ•\ufffd[00m " +
      "\ufffd[K\ufffd[?1h=\ufffd[?2004hclear\ufffd[?1l>\ufffd[?2004l\ufffd]2;clear";

    expect(normalizeTerminalTitle(title)).toBeNull();
  });

  it("rejects leaked ANSI fragments when their introducer became an unknown glyph", () => {
    const title =
      "â–¡[0mâ–¡[27mâ–¡[24mâ–¡[Jâ–¡[01;32mâžœ â–¡[36mblimyâ–¡[00m " +
      "â–¡[?2004hlsâ–¡[?2004lâ–¡]2;ls";

    expect(normalizeTerminalTitle(title)).toBeNull();
  });

  it("rejects empty and C1-controlled titles", () => {
    expect(normalizeTerminalTitle("   ")).toBeNull();
    expect(normalizeTerminalTitle("\u009b31mmain")).toBeNull();
  });
});
