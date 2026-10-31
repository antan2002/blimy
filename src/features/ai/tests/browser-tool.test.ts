import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createBrowserTools } from "@/features/ai/tools/browser-tool";
import type { LocalToolContext } from "@/features/ai/tools/types";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  openWebUrl: vi.fn(),
  isOpenableWebUrl: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/utils/open-web-url", () => ({
  openWebUrl: mocks.openWebUrl,
  isOpenableWebUrl: mocks.isOpenableWebUrl,
}));

function context(overrides: Partial<LocalToolContext> = {}): LocalToolContext {
  return {
    root: "/w",
    readOnly: false,
    signal: new AbortController().signal,
    runTool: async (_name, _kind, _input, _id, execute) => execute(),
    ...overrides,
  };
}

function tool(contextValue: LocalToolContext, name: "browser_action" | "open_in_browser") {
  return createBrowserTools(contextValue)[name] as unknown as {
    execute: (input: unknown, options: { toolCallId: string }) => Promise<unknown>;
  };
}

async function run(contextValue: LocalToolContext, input: Record<string, unknown>) {
  return tool(contextValue, "browser_action").execute(input, { toolCallId: "call-1" });
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
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.openWebUrl.mockReset();
    mocks.isOpenableWebUrl.mockReset();
    mocks.isOpenableWebUrl.mockReturnValue(true);
  });

  it("is not offered without a workspace root or in a read-only run", () => {
    expect(createBrowserTools(context({ root: "" }))).toEqual({});
    expect(createBrowserTools(context({ readOnly: true }))).toEqual({});
  });

  it("opens the url through the Tauri command and maps the page back", async () => {
    mocks.invoke.mockResolvedValue(page);
    const result = await run(context(), { url: "https://example.com" });
    expect(mocks.invoke).toHaveBeenCalledWith("execute_browser_action", {
      url: "https://example.com",
      action: null,
      selector: null,
      text: null,
    });
    expect(result).toEqual({
      url: "https://example.com",
      title: "Example",
      text: "<html>hi</html>",
      screenshotPath: "/tmp/shot.png",
      success: true,
    });
  });

  it("forwards a click action with its selector", async () => {
    mocks.invoke.mockResolvedValue(page);
    await run(context(), {
      url: "https://example.com",
      action: "click",
      selector: "#submit",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("execute_browser_action", {
      url: "https://example.com",
      action: "click",
      selector: "#submit",
      text: null,
    });
  });

  it("forwards a type action with its text", async () => {
    mocks.invoke.mockResolvedValue(page);
    await run(context(), {
      url: "https://example.com",
      action: "type",
      selector: "input[name=q]",
      text: "blimy",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("execute_browser_action", {
      url: "https://example.com",
      action: "type",
      selector: "input[name=q]",
      text: "blimy",
    });
  });

  it("passes a browser error back to the model", async () => {
    mocks.invoke.mockResolvedValue({ ...page, success: false, error: "ERR_NAME_NOT_RESOLVED" });
    const result = await run(context(), { url: "https://example.com" });
    expect(result).toMatchObject({ success: false, error: "ERR_NAME_NOT_RESOLVED" });
  });

  it("refuses a blocked scheme without calling the browser command", async () => {
    mocks.isOpenableWebUrl.mockReturnValue(false);
    const result = await run(context(), { url: "file:///etc/passwd" });
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  it("turns a command rejection into a readable error", async () => {
    mocks.invoke.mockRejectedValue(new Error("Blocked URL scheme 'file'"));
    const result = await run(context(), { url: "https://example.com" });
    expect(result).toMatchObject({ success: false, error: "Blocked URL scheme 'file'" });
  });

  it("opens a visible tab through the shared web-url policy", async () => {
    mocks.openWebUrl.mockResolvedValue(undefined);
    const result = await tool(context(), "open_in_browser").execute(
      { url: "http://localhost:3000" },
      { toolCallId: "call-2" },
    );
    expect(mocks.openWebUrl).toHaveBeenCalledWith("http://localhost:3000");
    expect(result).toEqual({ opened: true, url: "http://localhost:3000" });
  });

  it("reports a blocked url instead of claiming it opened", async () => {
    mocks.isOpenableWebUrl.mockReturnValue(false);
    const result = await tool(context(), "open_in_browser").execute(
      { url: "file:///etc/passwd" },
      { toolCallId: "call-3" },
    );
    expect(mocks.openWebUrl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ opened: false });
  });
});
