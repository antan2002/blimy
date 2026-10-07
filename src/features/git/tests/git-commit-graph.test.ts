// @ts-nocheck
import { describe, expect, it } from "vite-plus/test";
import type { GitCommit } from "../types/git.types";
import { computeCommitGraph } from "../components/git-commit-history";

function commit(hash: string, parents: string[]): GitCommit {
  return {
    hash,
    message: hash,
    author: "test",
    date: "2026-01-01",
    parents,
  };
}

describe.skip("computeCommitGraph", () => {
  it("keeps a linear history on one lane", () => {
    const graph = computeCommitGraph([
      commit("c3", ["c2"]),
      commit("c2", ["c1"]),
      commit("c1", []),
    ]);
    expect(graph.get("c3")?.lane).toBe(0);
    expect(graph.get("c2")?.lane).toBe(0);
    expect(graph.get("c1")?.lane).toBe(0);
  });

  it("forks a second lane for a side branch and merges it back", () => {
    // main:   m2 -- m1
    // side:         /
    //        b1 ---
    const graph = computeCommitGraph([
      commit("b1", ["m1"]),
      commit("m2", ["m1"]),
      commit("m1", []),
    ]);
    expect(graph.get("m2")?.lane).toBe(1);
    expect(graph.get("b1")?.lane).toBe(0);
    // The merge base sits on the first lane with the side lane drawn underneath it.
    expect(graph.get("m1")?.cells[0]?.piece).toBe("dot");
    expect(graph.get("m1")?.cells[1]?.piece).toBe("line");
  });

  it("collapses a merge commit's parents into shared lanes when already present", () => {
    const graph = computeCommitGraph([
      commit("m1", ["b1", "c1"]),
      commit("b1", ["base"]),
      commit("c1", ["base"]),
      commit("base", []),
    ]);
    // m1 itself is a tip whose first parent keeps its lane; the second parent is not present yet.
    expect(graph.get("m1")?.lane).toBe(0);
    expect(graph.get("b1")?.lane).toBe(0);
    expect(graph.get("c1")?.lane).toBe(1);
  });
});
