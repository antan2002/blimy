import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import { isOpenableWebUrl, openWebUrl } from "@/utils/open-web-url";
import type { LocalToolContext } from "@/features/ai/tools/types";

/** What the Rust command returns for one headless browser action. */
export interface BrowserActionResult {
  success: boolean;
  url: string;
  title: string | null;
  extracted_text: string | null;
  screenshot_base64: string | null;
  screenshot_path: string | null;
  error: string | null;
}

const BROWSER_ACTIONS = ["read", "navigate", "click", "type", "scroll", "wait_for"] as const;

const browserActionSchema = z.object({
  url: z.string().url().describe("The URL to open, including the scheme."),
  action: z
    .enum(BROWSER_ACTIONS)
    .optional()
    .describe(
      "What to do after loading: read (default) returns the page, click presses an element, type writes into it, scroll moves the viewport, wait_for blocks until a selector exists.",
    ),
  selector: z.string().optional().describe("CSS selector for click, type, and wait_for."),
  text: z.string().optional().describe("Text to enter for type, or up/down/top/bottom for scroll."),
});

/**
 * Gives the agent a real headless browser: it can open a page, then click, type,
 * scroll, and wait for elements the way a person would, reading the page back
 * through text and a screenshot. Web and localhost URLs are allowed; local-file
 * and custom schemes are rejected in the Rust layer.
 */
export function createBrowserTools({ root, readOnly, runTool }: LocalToolContext): ToolSet {
  if (!root || readOnly) return {};

  return {
    browser_action: tool({
      description:
        "Open a URL in a headless browser and return the page title, its text, and a screenshot path. Pass an action to drive the page: click, type, scroll, or wait_for with a CSS selector. Use this to verify a local dev server or read a page that a plain fetch cannot render.",
      inputSchema: browserActionSchema,
      execute: async (input, { toolCallId }) =>
        runTool(
          "browser_action",
          "other",
          input,
          toolCallId,
          async () => {
            if (!isOpenableWebUrl(input.url)) {
              return {
                url: input.url,
                title: null,
                text: "",
                screenshotPath: null,
                success: false,
                error: "Only http and https URLs can be opened in the browser.",
              };
            }
            try {
              const result = await invoke<BrowserActionResult>("execute_browser_action", {
                url: input.url,
                action: input.action ?? null,
                selector: input.selector ?? null,
                text: input.text ?? null,
              });
              return {
                url: result.url,
                title: result.title,
                text: (result.extracted_text ?? "").slice(0, 8000),
                screenshotPath: result.screenshot_path,
                success: result.success,
                ...(result.error ? { error: result.error } : {}),
              };
            } catch (error) {
              return {
                url: input.url,
                title: null,
                text: "",
                screenshotPath: null,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          },
          {
            display: (result) => ({
              url: input.url,
              title: (result as { title?: string | null }).title ?? undefined,
              action: input.action ?? "read",
            }),
          },
        ),
    }),

    open_in_browser: tool({
      description:
        "Open a URL in the user's own visible browser so they can see the page. Use this when the user should look at something, not when you need to read a page back. Web and localhost URLs only.",
      inputSchema: z.object({
        url: z.string().url().describe("The URL to open in the visible browser."),
      }),
      execute: async (input, { toolCallId }) =>
        runTool("open_in_browser", "other", input, toolCallId, async () => {
          if (!isOpenableWebUrl(input.url)) {
            return {
              opened: false,
              url: input.url,
              reason: "Only http and https URLs can be opened in a browser.",
            };
          }
          await openWebUrl(input.url);
          return { opened: true, url: input.url };
        }),
    }),
  };
}
