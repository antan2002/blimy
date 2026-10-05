import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createDesktopSignInStore } from "../stores/desktop-sign-in.store";

const oauthUrl = "https://project.supabase.co/auth/v1/authorize?provider=github";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  resolveOAuthRedirect: vi.fn(),
  stopAuthLoopback: vi.fn(),
}));

vi.mock("@/features/auth/lib/supabase", () => ({
  supabase: { auth: { signInWithOAuth: mocks.signInWithOAuth } },
}));

vi.mock("@/features/auth/lib/auth-callback-url", () => ({
  resolveOAuthRedirect: mocks.resolveOAuthRedirect,
}));

vi.mock("@/features/auth/lib/auth-loopback", () => ({
  stopAuthLoopback: mocks.stopAuthLoopback,
}));

const signInWithOAuth = mocks.signInWithOAuth;
const resolveOAuthRedirect = mocks.resolveOAuthRedirect;
const stopAuthLoopback = mocks.stopAuthLoopback;

beforeEach(() => {
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({ data: { url: oauthUrl }, error: null });
  resolveOAuthRedirect.mockReset();
  resolveOAuthRedirect.mockResolvedValue("http://127.0.0.1:38217/callback");
  stopAuthLoopback.mockReset();
  stopAuthLoopback.mockResolvedValue(undefined);
});

function setup() {
  const dependencies = { open: vi.fn(async () => {}) };
  return { dependencies, store: createDesktopSignInStore(dependencies) };
}

describe("shared desktop sign-in", () => {
  it("uses one browser session across entry points", async () => {
    const { store, dependencies } = setup();
    const first = store.getState().actions.signIn();
    const second = store.getState().actions.signIn();
    expect(first).toBe(second);
    expect(await first).toBe(true);
    expect(dependencies.open).toHaveBeenCalledOnce();
    expect(dependencies.open.mock.calls[0]).toEqual([oauthUrl]);
    expect(store.getState().loginUrl).toBe(oauthUrl);
  });

  it("requests the loopback callback so the browser always delivers it", async () => {
    const { store } = setup();
    await store.getState().actions.signIn();
    expect(resolveOAuthRedirect).toHaveBeenCalledOnce();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo: "http://127.0.0.1:38217/callback",
        skipBrowserRedirect: true,
      },
    });
  });

  it("signs in with google when asked", async () => {
    const { store } = setup();
    await store.getState().actions.signIn("google");
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });

  it("opens the same pending session again without asking the provider twice", async () => {
    const { store, dependencies } = setup();
    await store.getState().actions.signIn();
    await store.getState().actions.reopen();
    expect(dependencies.open).toHaveBeenCalledTimes(2);
    expect(dependencies.open.mock.calls[0]).toEqual(dependencies.open.mock.calls[1]);
    expect(signInWithOAuth).toHaveBeenCalledOnce();
  });

  it("keeps waiting after success because the deep link callback has not arrived yet", async () => {
    const { store } = setup();
    await store.getState().actions.signIn();
    expect(store.getState().isSigningIn).toBe(true);
  });

  it("never authenticates a canceled attempt even if the browser returns late", async () => {
    const { store } = setup();
    const pending = store.getState().actions.signIn();
    await Promise.resolve();
    store.getState().actions.cancel();
    expect(await pending).toBe(false);
    expect(store.getState().isSigningIn).toBe(false);
    expect(store.getState().loginUrl).toBeNull();
  });

  it("releases the loopback port when the attempt is canceled", async () => {
    const { store } = setup();
    store.getState().actions.signIn();
    store.getState().actions.cancel();
    expect(stopAuthLoopback).toHaveBeenCalledOnce();
  });

  it("stops waiting and keeps the real failure available to every sign-in surface", async () => {
    const { store } = setup();
    signInWithOAuth.mockRejectedValueOnce(new Error("Local auth server unavailable"));
    expect(await store.getState().actions.signIn()).toBe(false);
    expect(store.getState().error).toBe("Local auth server unavailable");
    expect(store.getState().isSigningIn).toBe(false);
    expect(store.getState().loginUrl).toBeNull();
  });

  it("stops waiting when the provider returns no url", async () => {
    const { store } = setup();
    signInWithOAuth.mockResolvedValueOnce({
      data: null,
      error: { message: "provider unavailable" },
    } as never);
    expect(await store.getState().actions.signIn()).toBe(false);
    expect(store.getState().error).toBe("provider unavailable");
    expect(store.getState().isSigningIn).toBe(false);
  });
});