/**
 * The access token of the live supabase-js session, for the `Authorization` header an edge
 * function expects.
 *
 * The account checks and the plan badge read `supabase.auth.getSession()`; edge functions must
 * be handed that same live token, not the value sitting in keychain storage. Storage can lag
 * the session supabase-js has already refreshed, and a stale header makes the edge function
 * answer "Not signed in" for an account that is very much signed in.
 *
 * Imported dynamically so this module stays free of the supabase client's runtime and cannot
 * join a static import cycle.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const { supabase } = await import("@/features/auth/lib/supabase");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}