import { type ComponentType, lazy } from "react";

const RELOAD_GUARD_KEY = "blimy:module-retry-reload-at";
const RELOAD_GUARD_WINDOW_MS = 20_000;

function reloadOnceAfterExhaustedRetries(): boolean {
  try {
    const lastReloadAt = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - lastReloadAt < RELOAD_GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps `React.lazy` with automatic retries to handle transient Vite
 * dependency optimization, network glitches, or HMR reloads while fetching
 * dynamic modules.
 *
 * In dev, Vite re-optimizes dependencies for tens of seconds after a lockfile
 * or config change, and requests hang or fail with 504s the whole time. The
 * dev defaults use a capped exponential backoff long enough to outlast that;
 * when retries are exhausted the page reloads once (guarded) instead of
 * crashing the window.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = import.meta.env.DEV ? 10 : 3,
  intervalMs = import.meta.env.DEV ? 500 : 400,
) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        const backoffMs = Math.min(intervalMs * 2 ** attempt, 5_000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
    if (import.meta.env.DEV && reloadOnceAfterExhaustedRetries()) {
      // Keep the current view mounted until navigation replaces it.
      await new Promise(() => {});
    }
    throw lastError;
  });
}
