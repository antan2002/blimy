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
  const signIn = async (provider: AuthProvider = "github") => {
    const completed = await actions.signIn(provider);
    if (completed) {
      toast.success("Signed in to blimy Desktop.");
      options.onSuccess?.();
    } else {
      const reason = useDesktopSignInStore.getState().error;
      if (reason) {
        toast.error(reason);
        throw new Error(reason);
      }
    }
  };

  return { signIn, isSigningIn, error, cancel: actions.cancel, reopen: actions.reopen };
}