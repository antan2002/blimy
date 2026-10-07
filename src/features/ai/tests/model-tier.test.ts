import { describe, expect, it } from "vitest";
import {
  LOCKED_MODEL_HINT,
  isModelLocked,
  isModelTier,
  planTierOf,
} from "@/features/ai/lib/model-tier";

describe("model tiers", () => {
  it("recognises only the three tiers the server sends", () => {
    expect(isModelTier("free")).toBe(true);
    expect(isModelTier("plus")).toBe(true);
    expect(isModelTier("pro")).toBe(true);
    expect(isModelTier("teams")).toBe(false);
    expect(isModelTier(undefined)).toBe(false);
    expect(isModelTier("")).toBe(false);
  });

  it("reads a subscription status as a plan tier", () => {
    expect(planTierOf("free")).toBe("free");
    expect(planTierOf("plus")).toBe("plus");
    expect(planTierOf("pro")).toBe("pro");
    expect(planTierOf("teams")).toBe("free");
    expect(planTierOf(null)).toBe("free");
    expect(planTierOf(undefined)).toBe("free");
  });

  it("locks a model only when its tier outranks the plan", () => {
    expect(isModelLocked("pro", "free")).toBe(true);
    expect(isModelLocked("pro", "plus")).toBe(true);
    expect(isModelLocked("pro", "pro")).toBe(false);
    expect(isModelLocked("plus", "free")).toBe(true);
    expect(isModelLocked("plus", "plus")).toBe(false);
    expect(isModelLocked("free", "free")).toBe(false);
  });

  it("treats a model with no tier as free, matching the server", () => {
    expect(isModelLocked(undefined, "free")).toBe(false);
    expect(isModelLocked(null, "free")).toBe(false);
    expect(isModelLocked("", "free")).toBe(false);
    expect(isModelLocked("enterprise", "free")).toBe(false);
  });

  it("names the upgrade in the locked-row hint", () => {
    expect(LOCKED_MODEL_HINT).toContain("Upgrade");
    expect(LOCKED_MODEL_HINT).toContain("Claude");
  });
});
