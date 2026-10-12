import { tauriFetch } from "@/utils/tauri-fetch";
import { getIntelligenceApiBase } from "@/utils/api-base";
import { getAccessToken, refreshSupabaseSession } from "@/utils/supabase-access-token";

const API_BASE = getIntelligenceApiBase();
const SEARCH_TIMEOUT_MS = 20_000;
const FETCH_TIMEOUT_MS = 20_000;

/** One search result the agent can cite: the headline fields plus a highlighted excerpt. */
export interface WebSearchResult {
  title: string;
  url: string;
  /** ISO date when the page was published, when the engine reported one. */
  publishedDate: string | null;
  snippet: string;
}

/** A whole web search: the query that produced it and the results the agent should work from. */
export interface WebSearchOutcome {
  query: string;
  results: WebSearchResult[];
}

export class IntelligenceWebError extends Error {
  status: number;
  hosted: boolean;

  constructor(message: string, status: number, options?: { hosted?: boolean }) {
    super(message);
    this.name = "IntelligenceWebError";
    this.status = status;
    this.hosted = options?.hosted ?? false;
  }
}

function jsonHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<IntelligenceWebError> {
  const body = await response.json().catch(() => null);
  const message =
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
      ? ((body as { error: string }).error ?? "")
      : fallback;
  return new IntelligenceWebError(message, response.status, { hosted: true });
}

/**
 * Runs one hosted web request. A 401 means the session token went stale while the app ran: the
 * token is refreshed and the request retried once, like the rest of the app's hosted calls.
 */
async function withRefreshOn401(
  request: (token: string, signal: AbortSignal) => Promise<Response>,
  fallback: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<Response> {
  let token = await getAccessToken();
  if (!token)
    throw new IntelligenceWebError(
      "Web search needs a blimy sign-in. Sign in (GitHub is supported) to use web search.",
      401,
      { hosted: true },
    );
  const timeoutMs = options?.timeoutMs ?? SEARCH_TIMEOUT_MS;
  const signal = options?.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  let response = await request(token, signal);
  if (response.status !== 401) return response;

  const refreshed = await refreshSupabaseSession();
  if (!refreshed) return response;
  const retried = await request(refreshed, signal);
  if (retried.status !== 401) return retried;
  const serverError = await responseError(retried, fallback).catch(() => null);
  throw new IntelligenceWebError(
    serverError && serverError.status === 401
      ? "Your blimy session was not accepted by the web search server. Sign out, then sign in again with your blimy account (GitHub)."
      : fallback,
    401,
    { hosted: true },
  );
}

/**
 * The agent's `web_search` tool: semantic search over current pages with token-efficient
 * highlights, served by the ai-proxy edge function so no search key ever ships in the app.
 */
export async function searchIntelligenceWeb(
  query: string,
  options?: { maxResults?: number; signal?: AbortSignal },
): Promise<WebSearchOutcome> {
  const response = await withRefreshOn401(
    (token, signal) =>
      tauriFetch(`${API_BASE}/web/search`, {
        signal,
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({
          query,
          ...(options?.maxResults ? { maxResults: options.maxResults } : {}),
        }),
      }),
    `Web search failed (401)`,
    options,
  );
  if (!response.ok) throw await responseError(response, `Web search failed (${response.status})`);
  const body = await response.json().catch(() => null);
  const results =
    body !== null &&
    typeof body === "object" &&
    Array.isArray((body as { results?: unknown }).results)
      ? (body as { results: WebSearchResult[] }).results
      : [];
  return { query, results };
}

/**
 * The agent's `fetch_url` tool: reads one page's readable text so it can summarize actual
 * content instead of only snippets. Served by the ai-proxy edge function.
 */
export async function fetchIntelligenceUrl(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<{ url: string; text: string }> {
  const response = await withRefreshOn401(
    (token, signal) =>
      tauriFetch(`${API_BASE}/web/fetch`, {
        signal,
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({ url }),
      }),
    `Could not read that page (401)`,
    { signal: options?.signal, timeoutMs: FETCH_TIMEOUT_MS },
  );
  if (!response.ok)
    throw await responseError(response, `Could not read that page (${response.status})`);
  const body = await response.json().catch(() => null);
  const text =
    body !== null &&
    typeof body === "object" &&
    typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";
  return { url, text };
}
