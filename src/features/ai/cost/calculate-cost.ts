import {
  DEFAULT_MODEL_PRICE,
  FREE_LOCAL_PROVIDERS,
  findModelPrice,
  type ModelPrice,
} from "./model-prices";

const TOKENS_PER_MILLION = 1_000_000;

function tokenCount(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

/** The price a model is billed at, including local providers that cost nothing. */
export function resolveModelPrice(modelId: string, providerId?: string): ModelPrice {
  if (providerId && FREE_LOCAL_PROVIDERS.has(providerId.toLowerCase())) {
    return { input: 0, output: 0 };
  }
  return findModelPrice(modelId) ?? DEFAULT_MODEL_PRICE;
}

/**
 * What a request cost, in US dollars. An unknown model uses the default price
 * rather than reporting zero, so an unrecognized model is never treated as free.
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  providerId?: string,
): number {
  const price = resolveModelPrice(modelId, providerId);
  const input = (tokenCount(inputTokens) / TOKENS_PER_MILLION) * price.input;
  const output = (tokenCount(outputTokens) / TOKENS_PER_MILLION) * price.output;
  return input + output;
}
