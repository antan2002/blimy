/**
 * The plan tier a hosted Blimy model requires. The server sends it per model on the catalog
 * and enforces the same split before any request is billed.
 */
export type ModelTier = "free" | "plus" | "pro";

const TIER_RANK: Readonly<Record<ModelTier, number>> = { free: 0, plus: 1, pro: 2 };

/** The tier a subscription grants; the server's `subscriptions.status` vocabulary. */
export type PlanTier = ModelTier;

export function isModelTier(value: unknown): value is ModelTier {
  return value === "free" || value === "plus" || value === "pro";
}

/**
 * The tier a subscription status grants. An unknown or missing status is free, so a
 * half-loaded account can never appear to own a paid tier.
 */
export function planTierOf(status: string | null | undefined): PlanTier {
  if (status === "plus" || status === "pro") return status;
  return "free";
}

/**
 * Whether the plan reaches a model. A model with no tier is free, matching the server:
 * only an explicit "plus"/"pro" on the catalog entry locks a row.
 */
export function isModelLocked(modelTier: string | null | undefined, plan: PlanTier): boolean {
  if (!isModelTier(modelTier)) return false;
  return TIER_RANK[modelTier] > TIER_RANK[plan];
}

/** The tooltip shown on a locked row: what the upgrade opens up. */
export const LOCKED_MODEL_HINT =
  "Upgrade to access the latest AI models from OpenAI, Anthropic (Claude) and etc.";
