import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const AUTH_LOOPBACK_EVENT = "auth:loopback-callback";

/**
 * The loopback transport for OAuth returns.
 *
 * A custom-scheme deep link is the nicest hand-off, but browsers treat a server-initiated
 * navigation to an unknown protocol inconsistently and can drop it without a prompt. A
 * plain `http://127.0.0.1` address is an ordinary web address, so every browser delivers
 * it. The Rust side owns the listener; this module only starts it and surfaces the callback.
 */

export interface AuthLoopback {
  /** The redirect URL to hand to the provider in place of a custom scheme. */
  redirectUrl: string;
  /** Releases the port. Awaited on cancel so a retry can rebind immediately. */
  stop: () => Promise<void>;
}

/** Resolves true when this build can serve a loopback callback. */
export async function supportsAuthLoopback(): Promise<boolean> {
  try {
    await invoke<string>("start_auth_loopback");
    await invoke<void>("stop_auth_loopback");
    return true;
  } catch {
    return false;
  }
}

/**
 * Reserve the loopback port and return its redirect URL. The listener stays open until one
 * callback arrives or {@link stopAuthLoopback} is called.
 */
export async function startAuthLoopback(): Promise<string> {
  return invoke<string>("start_auth_loopback");
}

export async function stopAuthLoopback(): Promise<void> {
  try {
    await invoke<void>("stop_auth_loopback");
  } catch {
    // The port is released when the listener thread finishes either way.
  }
}

/** Subscribe to the callback the listener captures. */
export async function onAuthLoopbackCallback(handler: (url: string) => void): Promise<UnlistenFn> {
  return listen<string>(AUTH_LOOPBACK_EVENT, (event) => {
    handler(event.payload);
  });
}

export const __test = { AUTH_LOOPBACK_EVENT };
