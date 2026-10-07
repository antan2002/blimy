/**
 * Prices last checked: 2026-09-29 (against each vendor's public pricing page).
 *
 * These are hand-entered and go stale as vendors change rates, so a budget that
 * looks wrong is more likely a stale price than a real change in spend. Refresh
 * this file when that happens; nothing fetches these at runtime.
 */

/** Price per one million tokens, in US dollars. */
export interface ModelPrice {
  input: number;
  output: number;
}

/**
 * Prices for models blimy can reach with a key the user supplies themselves.
 *
 * blimy's own hosted provider is left out on purpose: its server already reports
 * the cost of each response, so pricing it here would double-count.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic
  "claude-opus-4-5": { input: 5, output: 25 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-3-7-sonnet": { input: 3, output: 15 },
  "claude-3-5-haiku": { input: 0.8, output: 4 },
  // OpenAI
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  o3: { input: 2, output: 8 },
  "o4-mini": { input: 1.1, output: 4.4 },
  // Google
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  // Others blimy lists
  "grok-4": { input: 3, output: 15 },
  "mistral-large": { input: 2, output: 6 },
};

/** Used when a model is not in the table, so an unknown model is still accounted for. */
export const DEFAULT_MODEL_PRICE: ModelPrice = { input: 3, output: 15 };

/** Providers that bill the user nothing, because the compute is theirs. */
export const FREE_LOCAL_PROVIDERS = new Set(["ollama", "lmstudio", "llamacpp"]);

/**
 * Model ids often carry a date suffix (`claude-sonnet-4-5-20250929`) or a
 * namespace (`anthropic/claude-sonnet-4-5`). Matching the longest known prefix
 * keeps those on the real price instead of the default.
 */
export function findModelPrice(modelId: string): ModelPrice | undefined {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) return undefined;
  const direct = MODEL_PRICES[normalized];
  if (direct) return direct;

  const afterNamespace = normalized.split("/").pop() ?? normalized;
  const namespaced = MODEL_PRICES[afterNamespace];
  if (namespaced) return namespaced;

  let best: ModelPrice | undefined;
  let bestLength = 0;
  for (const [id, price] of Object.entries(MODEL_PRICES)) {
    if (normalized.startsWith(id) && id.length > bestLength) {
      best = price;
      bestLength = id.length;
    }
  }
  return best;
}
