import { describe, expect, it } from "vite-plus/test";
import type { ToolSet } from "ai";
import { LOCAL_TOOL_FACTORIES, buildLocalTools } from "@/features/ai/tools/registry";
import type { LocalToolContext, LocalToolFactory } from "@/features/ai/tools/types";

function context(overrides: Partial<LocalToolContext> = {}): LocalToolContext {
  return {
    root: "/w",
    readOnly: false,
    signal: new AbortController().signal,
    runTool: async (_name, _kind, _input, _id, execute) => execute(),
    ...overrides,
  };
}

function fakeTool(id: string) {
  return {
    description: id,
    inputSchema: {},
    execute: async () => id,
  } as unknown as ToolSet[string];
}

/** Adds factories for one test and restores the real registrations afterwards. */
function withFactories(factories: LocalToolFactory[], run: () => void) {
  const registered: LocalToolFactory[] = [...LOCAL_TOOL_FACTORIES];
  LOCAL_TOOL_FACTORIES.push(...factories);
  try {
    run();
  } finally {
    LOCAL_TOOL_FACTORIES.length = 0;
    LOCAL_TOOL_FACTORIES.push(...registered);
  }
}

describe("local tool registry", () => {
  it("builds the tools of every registered factory", () => {
    expect(Object.keys(buildLocalTools(context())).sort()).toEqual([
      "browser_action",
      "cancel_scheduled_run",
      "list_scheduled_runs",
      "query_indexed_docs",
      "schedule_agent_run",
      "search_web",
    ]);
    // A read-only run keeps tools that only read and drops the ones that change state.
    expect(Object.keys(buildLocalTools(context({ readOnly: true }))).sort()).toEqual([
      "query_indexed_docs",
      "search_web",
    ]);
  });

  it("merges an added factory with the registered ones and passes the context through", () => {
    const seen: LocalToolContext[] = [];
    withFactories(
      [
        () => ({ a: fakeTool("a") }),
        (context) => {
          seen.push(context);
          return { b: fakeTool("b") };
        },
      ],
      () => {
        const names = Object.keys(buildLocalTools(context()));
        expect(names).toContain("a");
        expect(names).toContain("b");
        expect(names).toContain("schedule_agent_run");
      },
    );
    expect(seen).toHaveLength(1);
    // The real registrations survive an added factory.
    expect(Object.keys(buildLocalTools(context())).sort()).toEqual([
      "browser_action",
      "cancel_scheduled_run",
      "list_scheduled_runs",
      "query_indexed_docs",
      "schedule_agent_run",
      "search_web",
    ]);
  });
});
