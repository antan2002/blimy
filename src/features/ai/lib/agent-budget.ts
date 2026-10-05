/**
 * The dollar limit one built-in agent turn may spend before it stops.
 *
 * `null` means no limit, which is the default: a cap the user did not ask for
 * should never interrupt a task.
 */
export const DEFAULT_AGENT_BUDGET_USD = null;

/** Any finite amount at or above this, or `null` for no limit. */
export function normalizeAgentBudgetUsd(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}
