import { useEffect } from "react";
import { useAuthStore } from "@/features/window/stores/auth.store";
import { useDesktopSignIn } from "@/features/window/hooks/use-desktop-sign-in";
import { GithubMark, GoogleMark } from "@/ui/brand-marks";
import { SignInIcon } from "@/ui/icons";

export function LoginScreen() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { signIn, isSigningIn } = useDesktopSignIn();

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4 text-white/50">
          <div className="size-8 animate-pulse rounded-full bg-white/20" />
          <p className="text-sm">Starting blimy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black p-4 lg:p-8 overflow-hidden">
      {/* Background radial gradient to give that soft fade effect */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-[200px] size-[800px]" />
      </div>

      <div className="relative z-10 flex h-full max-h-[800px] w-full max-w-[1200px] flex-row gap-0 rounded-3xl overflow-hidden bg-[#050505] shadow-2xl ring-1 ring-white/10">
        {/* Left Side: Image Pane */}
        <div className="relative hidden w-1/2 md:block">
          {/* Image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url('/login-bg.jpg')` }}
          />
          {/* Top Left Logo */}
          <div className="absolute top-8 left-8 flex items-center gap-2">
            <img src="/logo.png" alt="blimy" className="size-8 object-contain drop-shadow-md" />
            <span className="text-lg font-semibold text-white drop-shadow-md tracking-wide">
              blimy
            </span>
          </div>
          {/* Soft fade into the black background on the right edge */}
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050505] to-transparent" />
        </div>

        {/* Right Side: Auth Pane */}
        <div className="flex w-full flex-col justify-center px-8 sm:px-16 md:w-1/2 bg-[#050505]">
          <div className="max-w-md w-full mx-auto flex flex-col items-start">
            <h1 className="text-[2.5rem] font-medium leading-tight tracking-tight text-white mb-12 max-w-[350px]">
              Unlock your flow with blimy
            </h1>

            <div className="flex w-full flex-col gap-4 relative">
              {/* Google Button */}
              <button
                className="group relative flex w-full items-center justify-between overflow-hidden rounded-full border border-white/10 bg-[#1c1c1e] px-6 py-4 text-left text-white transition-all hover:bg-[#2c2c2e] hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSigningIn}
                onClick={() => signIn("google").catch(() => undefined)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex size-6 items-center justify-center rounded-full bg-white/10">
                    <GoogleMark className="size-3.5" />
                  </div>
                  <span className="text-base font-medium">Continue with Google</span>
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-white/10">
                  <ArrowRightSvg />
                </div>
              </button>

              {/* GitHub Button */}
              <button
                className="group relative flex w-full items-center justify-between overflow-hidden rounded-full border border-white/10 bg-[#1c1c1e] px-6 py-4 text-left text-white transition-all hover:bg-[#2c2c2e] hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSigningIn}
                onClick={() => signIn("github").catch(() => undefined)}
              >
                <div className="flex items-center gap-4">
                  <GithubMark className="size-6 text-white" />
                  <span className="text-base font-medium">Continue with GitHub</span>
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-white/5 transition-colors group-hover:bg-white/10">
                  <ArrowRightSvg />
                </div>
              </button>

              {/* Tooltip "Hi!" */}
              <div className="absolute -bottom-8 -right-4 flex items-center gap-2 animate-bounce">
                <div className="relative rounded-full bg-[#2c2c2e] border border-white/10 px-3 py-1.5 shadow-lg">
                  <div className="absolute -top-2 left-4 h-3 w-3 rotate-45 border-l border-t border-white/10 bg-[#2c2c2e]" />
                  <div className="flex items-center gap-2 text-sm text-white">
                    <img src="/logo.png" alt="Avatar" className="size-5 rounded-full" />
                    Hi!
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-12 text-xs font-medium leading-relaxed text-white/30 max-w-[320px]">
              By signing in, you agree to blimy AI's{" "}
              <a href="#" className="underline decoration-white/20 hover:text-white/60">
                Terms of Service
              </a>
              ,{" "}
              <a href="#" className="underline decoration-white/20 hover:text-white/60">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="#" className="underline decoration-white/20 hover:text-white/60">
                Data Usage Properties
              </a>
              .
            </p>

            {isSigningIn && (
              <p className="mt-8 text-xs text-white/40 animate-pulse font-medium tracking-wide">
                WAITING FOR BROWSER AUTHENTICATION...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple right arrow SVG
function ArrowRightSvg() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 opacity-80 group-hover:opacity-100 transition-opacity"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
