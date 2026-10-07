const FALLBACK_SUPABASE_URL = "https://dummy.supabase.co";

function parseProjectRef(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    return host ? (host.split(".")[0] ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * The canonical Supabase storage key for this project: `sb-<project-ref>-auth-token`. Deriving
 * it from the project URL keeps the desktop keychain key in sync with the key Supabase itself
 * uses, so a session saved by any flow is found by the same storage.
 */
export function getSupabaseAuthStorageKey(supabaseUrl?: string): string {
  const url = supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
  const ref = parseProjectRef(url || FALLBACK_SUPABASE_URL);
  return ref ? `sb-${ref}-auth-token` : "sb-unknown-auth-token";
}

/** The key the old first-party backend used, kept only for one-time cleanup. */
export const LEGACY_AUTH_STORAGE_KEY = "blimy_auth_token";
