import { type ComponentType, lazy } from "react";

/**
 * Wraps `React.lazy` with automatic retries to handle transient Vite dependency optimization,
 * network glitches, or HMR reloads during dynamic module fetching.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  intervalMs = 400,
) {
  return lazy(async () => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        if (attempt === retries - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs * (attempt + 1)));
      }
    }
    return factory();
  });
}
