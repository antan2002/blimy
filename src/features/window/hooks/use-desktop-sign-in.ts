import { toast } from "sonner";
import { useDesktopSignInStore } from "../stores/desktop-sign-in.store";

type AuthProvider = "github" | "google";

interface UseDesktopSignInOptions {
  onSuccess?: () => void;
}

export function useDesktopSignIn(options: UseDesktopSignInOptions = {}) {
  const isSigningIn = useDesktopSignInStore((state) => state.isSigningIn);
  const error = useDesktopSignInStore((state) => state.error);
  const actions = useDesktopSignInStore((state) => state.actions);

  /**
   * Shows the outcome as a toast. It also rejects on failure so callers can stop a
   * follow-up step; a caller that only starts sign-in must catch that rejection.
   */
  const settle = async (attempt: Promise<boolean>) => {
    const completed = await attempt;
    if (completed) {
      toast.success("Signed in to blimy Desktop.");
      options.onSuccess?.();
      return;
    }
    const reason = useDesktopSignInStore.getState().error;
    if (reason) {
      toast.error(reason);
      throw new Error(reason);
    }
  };

  const signIn = (provider: AuthProvider = "github") => settle(actions.signIn(provider));

  const signInWithSso = (domain: string) => settle(actions.signInWithSso(domain));

  return {
    signIn,
    signInWithSso,
    isSigningIn,
    error,
    cancel: actions.cancel,
    reopen: actions.reopen,
  };
}
