import { getEdgeFunctionsBase } from "@/utils/api-base";
import { getSupabaseAccessToken, refreshSupabaseSession } from "@/utils/supabase-access-token";
import { tauriFetch } from "@/utils/tauri-fetch";

export interface EdgeRequestResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * One Supabase edge-function call with the live session token.
 *
 * The edge functions answer 401 when the access token handed to them is stale, and unlike
 * PostgREST calls they never retry. A 401 here forces a session refresh and retries once so a
 * token that was valid a moment ago cannot fail the request.
 */
export async function supabaseEdgeRequest(
  functionName: string,
  init?: RequestInit,
  path = "",
  tokenOverride?: string,
): Promise<EdgeRequestResult> {
  const url = `${getEdgeFunctionsBase()}/${functionName}${path}`;
  const execute = async (token: string) =>
    tauriFetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
      signal: AbortSignal.timeout(10000),
    });

  const first = tokenOverride ?? (await getSupabaseAccessToken());
  if (!first) return { ok: false, status: 401, body: { error: "Not signed in." } };

  let response = await execute(first);
  if (response.status === 401) {
    const fresh = await refreshSupabaseSession();
    if (fresh) response = await execute(fresh);
  }

  const body = (await response.json().catch(() => null)) as unknown;
  return { ok: response.ok, status: response.status, body };
}
