import { describe, expect, it } from "vite-plus/test";
import { stripAnsi } from "../utils/strip-ansi";

describe("stripAnsi", () => {
  it("returns empty string for empty input", () => {
    expect(stripAnsi("")).toBe("");
  });

  it("leaves plain text untouched", () => {
    expect(stripAnsi("hello world\nfoo bar")).toBe("hello world\nfoo bar");
  });

  it("strips standard ANSI color and formatting codes", () => {
    const raw = "\u001b[31mError:\u001b[0m \u001b[1;32mBuild succeeded\u001b[0m";
    expect(stripAnsi(raw)).toBe("Error: Build succeeded");
  });

  it("strips terminal control sequences and normalizes line breaks", () => {
    const raw = "Line 1\r\n\u001b[2K\u001b[?25hLine 2\rLine 3";
    expect(stripAnsi(raw)).toBe("Line 1\nLine 2\nLine 3");
  });
});
