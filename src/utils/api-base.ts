import SERVICE_DEFAULTS from "@/config/services.json";

export const DEFAULT_API_BASE = SERVICE_DEFAULTS.apiBaseUrl;

/**
 * Base URL for hosted model requests.
 *
 * This is deliberately not `getApiBase()`. Hosted AI runs on Supabase edge functions, which is
 * the one place the project already authenticates and can read a plan from, so it needs no
 * separate host of its own. Keeping it separate also means the two can move independently.
 */
export function getIntelligenceApiBase(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("Hosted models are unavailable: VITE_SUPABASE_URL is not configured.");
  }
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/ai-proxy`;
}

/**
 * Base URL for Supabase edge functions generally.
 *
 * Kept separate from `getIntelligenceApiBase()`, which resolves to one named function. Callers
 * that talk to a different function need only the directory, so adding one should not mean
 * threading a function name through a helper that already has an opinion.
 */
export function getEdgeFunctionsBase(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("This feature is unavailable: VITE_SUPABASE_URL is not configured.");
  }
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1`;
}

export function isLocalApiBase(value: string): boolean {
  return value.includes("localhost") || value.includes("127.0.0.1");
}

export function getApiBase(): string {
  const configuredApiBase = import.meta.env.VITE_API_URL?.trim();

  if (!configuredApiBase) {
    return DEFAULT_API_BASE;
  }

  if (import.meta.env.PROD && isLocalApiBase(configuredApiBase)) {
    return DEFAULT_API_BASE;
  }

  return configuredApiBase;
}

export const __test__ = {
  isLocalApiBase,
  getIntelligenceApiBase,
};
