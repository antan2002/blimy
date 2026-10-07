/**
 * The access token of the live supabase-js session, for the `Authorization` header an edge
 * function expects.
 *
 * The account checks and the plan badge read `supabase.auth.getSession()`; edge functions must
 * be handed that same live token, not the value sitting in keychain storage. Storage can lag
 * the session supabase-js has already refreshed, and a stale header makes the edge function
 * answer "Not signed in" for an account that is very much signed in.
 *
 * `getSession()` also returns the token it has in memory as-is. Since the edge functions do not
 * retry on 401 the way PostgREST does, an access token near expiry is refreshed here first so
 * the header is never sent expired.
 *
 * Imported dynamically so this module stays free of the supabase client's runtime and cannot
 * join a static import cycle.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const { supabase } = await import("@/features/auth/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  const getFallbackToken = async () => {
    const { getAuthToken } = await import("@/features/window/services/auth-api");
    const raw = await getAuthToken();
    if (!raw) return null;
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        return parsed.access_token || raw;
      } catch {
        return raw;
      }
    }
    return raw;
  };

  if (!session?.access_token) return getFallbackToken();

  const expiresAtSeconds = session.expires_at;
  const isExpired = expiresAtSeconds == null || expiresAtSeconds * 1000 - Date.now() <= 30_000;
  if (!isExpired) return session.access_token;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session?.access_token) return getFallbackToken();
  return refreshed.session.access_token;
}

export async function refreshSupabaseSession(): Promise<string | null> {
  const { supabase } = await import("@/features/auth/lib/supabase");
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session?.access_token) return null;
  return refreshed.session.access_token;
}

