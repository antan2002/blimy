import { useEffect } from "react";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { emit, listen } from "@tauri-apps/api/event";
import { supabase } from "@/features/auth/lib/supabase";
import { stopAuthLoopback } from "@/features/auth/lib/auth-loopback";
import { removeAuthToken } from "@/features/window/services/auth-api";

const SESSION_CHANGED_EVENT = "auth:session-changed";

const AUTH_CALLBACK_PREFIXES = ["blimy://auth/callback", "blimy-preview://auth/callback"];

/** A one-time authorization code cannot be exchanged twice, so each URL is claimed once. */
const handledCallbacks = new Set<string>();

function isAuthCallback(url: string) {
  if (url.startsWith("http://127.0.0.1:")) return url.includes("/callback");
  return AUTH_CALLBACK_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Owns the return leg of the OAuth round trip. The browser finishes authorization and
 * the OS hands the callback back through the deep link plugin, so this component has to
 * turn that code into a session before anything else can consider the user signed in.
 *
 * `getCurrent()` is read as well as `onOpenUrl`, because a cold start delivers the
 * launching URL before this effect subscribes; without it a callback that starts the
 * app is dropped and sign-in silently never completes.
 */
export function AuthListener() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let unlistenSession: (() => void) | undefined;
    let unlistenLoopback: (() => void) | undefined;
    let disposed = false;

    const completeSignIn = async () => {
      // The listener has already served its one callback by this point.
      void stopAuthLoopback();
      await ensureFreeSubscription();

      const { useAuthStore } = await import("@/features/window/stores/auth.store");
      await useAuthStore.getState().actions.initialize();

      const { useDesktopSignInStore } =
        await import("@/features/window/stores/desktop-sign-in.store");
      useDesktopSignInStore.getState().actions.cancel();

      // Other windows keep their own Supabase client and secret cache, so signing in
      // once has to sign in the whole app.
      void emit(SESSION_CHANGED_EVENT).catch(() => {});
    };

    const processUrls = async (urls: string[]) => {
      for (const url of urls) {
        if (!isAuthCallback(url)) continue;

        // Both transports can deliver while only one was ever requested, and the same
        // code cannot be exchanged twice. First one to arrive wins.
        if (handledCallbacks.has(url)) continue;
        handledCallbacks.add(url);

        let code: string | null = null;
        let errorDescription: string | null = null;
        try {
          const parsed = new URL(url);
          code = parsed.searchParams.get("code");
          errorDescription =
            parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
        } catch (parseError) {
          console.error("[auth] Could not parse the callback URL:", parseError);
          handledCallbacks.delete(url);
          continue;
        }

        if (errorDescription) {
          console.error("[auth] The provider rejected sign-in:", errorDescription);
          const { useDesktopSignInStore } =
            await import("@/features/window/stores/desktop-sign-in.store");
          useDesktopSignInStore.setState({ isSigningIn: false, loginUrl: null });
          void stopAuthLoopback();
          continue;
        }

        if (!code) {
          // A callback with no code means either the provider rejected the redirect or
          // Supabase declined to hand the code to it. Both are worth naming, because the
          // fix lives in the project's redirect configuration and not in this code.
          console.error(
            "[auth] The callback carried no code. The redirect URL has to be listed under " +
              "Authentication > URL Configuration in the Supabase project. " +
              `Callback was: ${url}`,
          );
          const { useDesktopSignInStore } =
            await import("@/features/window/stores/desktop-sign-in.store");
          useDesktopSignInStore.setState({ isSigningIn: false, loginUrl: null });
          void stopAuthLoopback();
          continue;
        }

        void supabase.auth
          .exchangeCodeForSession(code)
          .then(async ({ data, error }) => {
            if (error) {
              console.error("[auth] Failed to exchange the code for a session:", error);
              const { useDesktopSignInStore } =
                await import("@/features/window/stores/desktop-sign-in.store");
              useDesktopSignInStore.setState({ isSigningIn: false, loginUrl: null });
              void stopAuthLoopback();
              return;
            }

            if (data?.session) {
              const provider = data.session.user?.app_metadata?.provider;
              const providers = data.session.user?.app_metadata?.providers || [];
              const isGitHub = provider === "github" || providers.includes("github");

              if (isGitHub && data.session.provider_token) {
                const { storeGitHubToken } =
                  await import("@/features/github/services/github-token-service");
                await storeGitHubToken(data.session.provider_token).catch((err) => {
                  console.error("[auth] Failed to store GitHub token locally:", err);
                });
              }
            }

            await completeSignIn();
          })
          .catch((exchangeError: unknown) => {
            console.error("[auth] The code exchange threw:", exchangeError);
            void stopAuthLoopback();
          });
      }
    };

    const setupListener = async () => {
      try {
        unlistenSession = await listen(SESSION_CHANGED_EVENT, () => {
          void applySessionChange();
        });
      } catch (error) {
        console.error("[auth] Failed to listen for session changes:", error);
      }

      if (disposed) {
        unlistenSession?.();
        return;
      }

      try {
        // A cold start delivers the launching URL before this effect runs, so it has to
        // be drained here rather than waiting for an event that has already fired.
        const { getCurrent } = await import("@tauri-apps/plugin-deep-link");
        const initialUrls = await getCurrent().catch((error: unknown) => {
          console.error("[auth] Could not read the launch deep links:", error);
          return null;
        });
        if (initialUrls?.length) processUrls(initialUrls);

        unlisten = await onOpenUrl(processUrls);
      } catch (error) {
        console.error("[auth] Failed to set up the deep link listener:", error);
      }

      // The loopback transport is the reliable one, so it is subscribed too. Only one of
      // the two will fire: whichever redirect the provider was actually given.
      try {
        const { onAuthLoopbackCallback } = await import("@/features/auth/lib/auth-loopback");
        unlistenLoopback = await onAuthLoopbackCallback((url) => {
          void processUrls([url]);
        });
      } catch (error) {
        console.error("[auth] Failed to set up the loopback listener:", error);
      }
    };

    void setupListener();

    return () => {
      disposed = true;
      unlisten?.();
      unlistenSession?.();
      unlistenLoopback?.();
    };
  }, []);

  return null;
}

/**
 * A window that did not perform the sign-in has its own Supabase client and its own
 * in-process secret cache, so it has to be told. Clearing the local token first is what
 * makes a sign-out visible here: without it the cached copy would still read as signed in.
 */
async function applySessionChange() {
  const { useAuthStore } = await import("@/features/window/stores/auth.store");
  const { clearAuthTokenCache } = await import("@/features/window/services/auth-api");

  // Clear the in-memory cache so `initialize` re-reads from secure storage.
  // Do NOT call removeAuthToken(), as that deletes the new token from the OS keychain!
  clearAuthTokenCache();

  await useAuthStore.getState().actions.initialize();
}

async function ensureFreeSubscription() {
  try {
    const { error } = await supabase.rpc("ensure_free_subscription");
    if (error) {
      console.warn("[auth] Could not ensure a free subscription:", error.message);
    }
  } catch (error) {
    console.warn("[auth] Could not ensure a free subscription:", error);
  }
}
