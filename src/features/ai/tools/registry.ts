import type { ToolSet } from "ai";
import { createScheduleTools } from "@/features/ai/tools/schedule-tool";
import { createSubagentTools } from "@/features/ai/tools/spawn-subagent-tool";
import { createDocsQueryTool } from "@/features/ai/tools/docs-query-tool";
import { createWebSearchTool } from "@/features/ai/tools/web-search-tool";
import { createBrowserTools } from "@/features/ai/tools/browser-tool";
import { createGitHubPullRequestTools } from "@/features/ai/tools/github-pr-tool";
import type { LocalToolContext, LocalToolFactory } from "@/features/ai/tools/types";

/**
 * One entry per tool group. New agent tools are added by writing a factory in its own module and
 * registering it here, instead of growing the tool object inside the agent service.
 */
export const LOCAL_TOOL_FACTORIES: LocalToolFactory[] = [
  createScheduleTools,
  createSubagentTools,
  createDocsQueryTool,
  createWebSearchTool,
  createBrowserTools,
  createGitHubPullRequestTools,
];

/** Every locally built tool for one agent run, keyed by tool name. */
export function buildLocalTools(context: LocalToolContext): ToolSet {
  const tools: ToolSet = {};
  for (const factory of LOCAL_TOOL_FACTORIES) {
    Object.assign(tools, factory(context));
  }
  return tools;
}
