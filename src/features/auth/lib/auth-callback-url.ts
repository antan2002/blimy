import { getName } from "@tauri-apps/api/app";

const FALLBACK_SCHEME = "blimy";

const SUPPORTED_SCHEMES = new Set(["blimy", "blimy-dev", "blimy-preview"]);

let cachedCallbackUrl: string | null = null;

function schemeForProductName(productName: string): string {
  const slug = productName.trim().toLowerCase().replace(/\s+/g, "-");
  return SUPPORTED_SCHEMES.has(slug) ? slug : FALLBACK_SCHEME;
}

/**
 * Resolves the OAuth callback to the deep link scheme this build registered, so the
 * OS can hand the browser redirect back to the app. The scheme is derived from the
 * product name in the active tauri config: "Blimy" is the packaged build, "Blimy
 * Preview" is `bun dev`. A hardcoded scheme silently breaks the callback on every
 * other build, because nothing is listening on it.
 */
export async function authCallbackUrl(): Promise<string> {
  if (cachedCallbackUrl) return cachedCallbackUrl;

  let scheme = FALLBACK_SCHEME;
  try {
    scheme = schemeForProductName(await getName());
  } catch (error) {
    console.warn(`[auth] Could not read the app name; using ${FALLBACK_SCHEME}://`, error);
  }

  cachedCallbackUrl = `${scheme}://auth/callback`;
  return cachedCallbackUrl;
}

/**
 * The address OAuth should redirect to for this sign-in attempt.
 *
 * A custom scheme reads better, but browsers are free to ignore a server-initiated
 * navigation to a protocol they have no gesture for, and some drop it without any prompt.
 * Loopback is an ordinary web address, so it is always delivered. A failure to reserve the
 * port must not block sign-in, so this falls back to the deep link rather than throwing.
 */
export async function resolveOAuthRedirect(): Promise<string> {
  try {
    const { startAuthLoopback } = await import("@/features/auth/lib/auth-loopback");
    return await startAuthLoopback();
  } catch (error) {
    console.warn(
      "[auth] Could not reserve the loopback port; falling back to the deep link.",
      error,
    );
    return authCallbackUrl();
  }
}

export function resetAuthCallbackUrlCache(): void {
  cachedCallbackUrl = null;
}

export const __test__ = { FALLBACK_SCHEME, SUPPORTED_SCHEMES, schemeForProductName };
