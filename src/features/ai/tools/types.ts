import type { ToolSet } from "ai";
import type { AcpToolCallLocation, AcpToolKind } from "@/features/ai/types/acp.types";

/** The shared tracking wrapper every agent tool runs through. */
export type LocalToolRun = <T>(
  name: string,
  kind: AcpToolKind,
  input: unknown,
  id: string,
  execute: () => Promise<T>,
  options?: {
    locations?: AcpToolCallLocation[];
    /** What the transcript shows for this call; the model still receives the plain result. */
    display?: (result: T) => unknown;
  },
) => Promise<T>;

/** What a nested agent run hands back to the tool that started it. */
export interface SubagentOutcome {
  task: string;
  /** The child's final message, already capped for the parent's context. */
  summary: string;
  steps: number;
  costUsd?: number;
  outcome: "completed" | "cancelled" | "budget" | "failed";
  /** True when the child stopped at its step cap instead of finishing. */
  truncated: boolean;
  error?: string;
}

/** What a tool factory needs from the agent run. Built-in tools are only offered with a root. */
export interface LocalToolContext {
  /** Absolute workspace root. */
  root: string;
  readOnly: boolean;
  signal: AbortSignal;
  runTool: LocalToolRun;
  /** Runs one nested agent turn. Absent when nesting is not allowed for this run. */
  runSubagent?: (input: { task: string; maxSteps?: number }) => Promise<SubagentOutcome>;
}

/** Builds one group of agent tools from the shared run context. */
export type LocalToolFactory = (context: LocalToolContext) => ToolSet;
