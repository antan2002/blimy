import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";
import type { LocalToolContext } from "./types";

export function createWebSearchTool({ root, runTool }: LocalToolContext): ToolSet {
  if (!root) return {};
  return {
    search_web: tool({
      description: "Search the web for real-time information",
      inputSchema: z.object({ query: z.string().min(1).max(200) }),
      execute: async (input, { toolCallId }) =>
        runTool("search_web", "search", input, toolCallId, async () => {
          try {
            const res = await invoke("intelligence_fetch_url", {
              root,
              url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(input.query)}`,
            });
            return { results: String(res).slice(0, 5000) };
          } catch (err: any) {
            return { error: `Failed: ${err.message}` };
          }
        }),
    }),
  };
}
