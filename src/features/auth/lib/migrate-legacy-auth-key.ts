import { LEGACY_AUTH_STORAGE_KEY } from "@/features/auth/lib/auth-storage-key";
import { clearAuthTokenCache, removeAuthToken } from "@/features/window/services/auth-api";

const MIGRATION_FLAG = "blimy.auth.legacyKeyMigrated";

/**
 * Removes the old `blimy_auth_token` keychain entry exactly once, so a stale session from the
 * first-party backend can never shadow the Supabase session stored under `sb-<ref>-auth-token`.
 */
export async function removeLegacyAuthTokenOnce(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;
  } catch {
    return;
  }
  try {
    await removeAuthToken(LEGACY_AUTH_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to remove the legacy auth token:", error);
  } finally {
    clearAuthTokenCache(LEGACY_AUTH_STORAGE_KEY);
    try {
      localStorage.setItem(MIGRATION_FLAG, "1");
    } catch {
      // Read-only storage must not block startup.
    }
  }
}
