import { z } from "zod";
import type { ToolSet } from "ai";
import type { LocalToolFactory } from "./types";
import { docsIndexer } from "@/features/ai/docs/docs-indexer";

const inputSchema = z.object({
  query: z.string().min(1).describe("Search query for indexed docs"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results"),
});

export const createDocsQueryTool: LocalToolFactory = ({ root, ...context }) => {
  if (!root) return {};
  return {
    query_indexed_docs: {
      description: "Query local indexed docs store (from @docs)",
      inputSchema,
      execute: async (input) => {
        return await context.runTool(
          "query_indexed_docs",
          "search",
          input,
          crypto.randomUUID(),
          async () => {
            const parsed = inputSchema.parse(input);
            const results = await docsIndexer.query(parsed.query, parsed.limit);
            return {
              results: results.map((r) => ({
                id: r.id,
                url: r.url,
                title: r.title,
                content: r.content.slice(0, 1000),
                score: r.score,
              })),
            };
          },
        );
      },
    },
  } as ToolSet;
};
