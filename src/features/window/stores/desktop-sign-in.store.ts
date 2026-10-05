import { openUrl } from "@tauri-apps/plugin-opener";
import { create } from "zustand";
import { createSelectors } from "@/utils/zustand-selectors";
import { resolveOAuthRedirect } from "@/features/auth/lib/auth-callback-url";
import { stopAuthLoopback } from "@/features/auth/lib/auth-loopback";

interface Dependencies {
  open: (url: string) => Promise<void>;
}

interface State {
  isSigningIn: boolean;
  loginUrl: string | null;
  error: string | null;
  actions: {
    signIn: (provider?: "github" | "google") => Promise<boolean>;
    cancel: () => void;
    reopen: () => Promise<void>;
  };
}

export function createDesktopSignInStore(dependencies: Dependencies) {
  let pending: Promise<boolean> | null = null;
  let controller: AbortController | null = null;
  return create<State>()((set, get) => ({
    isSigningIn: false,
    loginUrl: null,
    error: null,
    actions: {
      signIn: (provider: "github" | "google" = "github") => {
        if (pending) return pending;
        const attempt = new AbortController();
        controller = attempt;
        set({ isSigningIn: true, error: null });
        const request = (async () => {
          try {
            const { supabase } = await import("@/features/auth/lib/supabase");
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider,
              options: {
                redirectTo: await resolveOAuthRedirect(),
                skipBrowserRedirect: true, // We want to handle the URL opening
              },
            });
            
            attempt.signal.throwIfAborted();
            
            if (error || !data?.url) {
              throw new Error(error?.message || "Failed to get Supabase OAuth URL.");
            }
            
            set({ loginUrl: data.url });
            await dependencies.open(data.url);
            // The browser returns the code to AuthListener via the deep link, which
            // cancels this store once the code has been exchanged for a session.
            return true;
          } catch (error) {
            if (attempt.signal.aborted) return false;
            set({ error: error instanceof Error ? error.message : "Sign-in failed." });
            return false;
          } finally {
            // A browser failure will never produce a deep link callback, so the wait is over.
            // A success keeps isSigningIn set until AuthListener cancels it after the exchange.
            if (get().error !== null) {
              set({ isSigningIn: false, loginUrl: null });
            }
          }
        })();
        pending = request;
        return request;
      },
      cancel: () => {
        controller?.abort();
        controller = null;
        pending = null;
        set({ isSigningIn: false, loginUrl: null, error: null });
        // Releasing the port here lets an immediate retry rebind without waiting out
        // the listener's timeout.
        void stopAuthLoopback();
      },
      reopen: async () => {
        const url = get().loginUrl;
        if (url) await dependencies.open(url);
      },
    },
  }));
}

export const useDesktopSignInStore = createSelectors(
  createDesktopSignInStore({
    open: openUrl,
  }),
);

if (import.meta.hot)
  import.meta.hot.dispose(() => useDesktopSignInStore.getState().actions.cancel());
