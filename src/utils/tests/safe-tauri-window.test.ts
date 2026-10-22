import { describe, expect, it } from "vitest";
import { safeGetCurrentWebviewWindow, safeGetCurrentWindow } from "../safe-tauri-window";

describe("safe-tauri-window", () => {
  it("returns null or instance without throwing in test environment", () => {
    expect(() => safeGetCurrentWindow()).not.toThrow();
    expect(() => safeGetCurrentWebviewWindow()).not.toThrow();
  });
});
