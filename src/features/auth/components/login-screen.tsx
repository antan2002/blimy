import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "@/ui/button";
import { GithubMark } from "@/ui/brand-marks";

export function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (provider: "github" | "google") => {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Tauri deep link handler scheme
          redirectTo: "blimy://auth",
        },
      });
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh w-dvw flex-col items-center justify-center bg-surface">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Welcome to Blimy</h1>
        <p className="text-sm text-subtle-foreground">
          Sign in to sync your workspace and AI chat history.
        </p>
        <div className="flex w-full flex-col gap-3 mt-4">
          <Button
            size="lg"
            width="full"
            disabled={loading}
            onMouseDown={() => handleLogin("github")}
          >
            <GithubMark size={16} />
            <span>Continue with GitHub</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            width="full"
            disabled={loading}
            onMouseDown={() => handleLogin("google")}
          >
            <span>Continue with Google</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
