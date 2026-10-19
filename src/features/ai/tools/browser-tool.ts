import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
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

/**
 * Lets the agent open a page in a headless Chromium instance and read it back,
 * so it can check a local dev server or a docs page the way a person would.
 */
export function createBrowserTools({ root, readOnly, runTool }: LocalToolContext): ToolSet {
  if (!root || readOnly) return {};

  return {
    browser_action: tool({
      description:
        "Open a URL in a headless browser and return the page title, its text, and a screenshot path. Use this to verify a local dev server or read a page that a plain fetch cannot render.",
      inputSchema: z.object({
        url: z.string().url().describe("The URL to open, including the scheme."),
      }),
      execute: async (input, { toolCallId }) =>
        runTool(
          "browser_action",
          "other",
          input,
          toolCallId,
          async () => {
            const result = await invoke<BrowserActionResult>("execute_browser_action", {
              url: input.url,
            });
            return {
              url: result.url,
              title: result.title,
              text: (result.extracted_text ?? "").slice(0, 8000),
              screenshotPath: result.screenshot_path,
              success: result.success,
              ...(result.error ? { error: result.error } : {}),
            };
          },
          {
            display: (result) => ({
              url: input.url,
              title: (result as { title?: string | null }).title ?? undefined,
            }),
          },
        ),
    }),
  };
}
