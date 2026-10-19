import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createBrowserTools } from "@/features/ai/tools/browser-tool";
import type { LocalToolContext } from "@/features/ai/tools/types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

function context(overrides: Partial<LocalToolContext> = {}): LocalToolContext {
  return {
    root: "/w",
    readOnly: false,
    signal: new AbortController().signal,
    runTool: async (_name, _kind, _input, _id, execute) => execute(),
    ...overrides,
  };
}

async function run(contextValue: LocalToolContext, url: string) {
  const tool = createBrowserTools(contextValue).browser_action as unknown as {
    execute: (input: unknown, options: { toolCallId: string }) => Promise<unknown>;
  };
  return tool.execute({ url }, { toolCallId: "call-1" });
}

const page = {
  success: true,
  url: "https://example.com",
  title: "Example",
  extracted_text: "<html>hi</html>",
  screenshot_base64: null,
  screenshot_path: "/tmp/shot.png",
  error: null,
};

describe("browser tool", () => {
  beforeEach(() => mocks.invoke.mockReset());

  it("is not offered without a workspace root or in a read-only run", () => {
    expect(createBrowserTools(context({ root: "" }))).toEqual({});
    expect(createBrowserTools(context({ readOnly: true }))).toEqual({});
  });

  it("opens the url through the Tauri command and maps the page back", async () => {
    mocks.invoke.mockResolvedValue(page);
    const result = await run(context(), "https://example.com");
    expect(mocks.invoke).toHaveBeenCalledWith("execute_browser_action", {
      url: "https://example.com",
    });
    expect(result).toEqual({
      url: "https://example.com",
      title: "Example",
      text: "<html>hi</html>",
      screenshotPath: "/tmp/shot.png",
      success: true,
    });
  });

  it("passes a browser error back to the model", async () => {
    mocks.invoke.mockResolvedValue({ ...page, success: false, error: "ERR_NAME_NOT_RESOLVED" });
    const result = await run(context(), "https://example.com");
    expect(result).toMatchObject({ success: false, error: "ERR_NAME_NOT_RESOLVED" });
  });
});
