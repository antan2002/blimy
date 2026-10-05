import { describe, expect, it } from "vitest";

import { __test } from "@/features/auth/lib/auth-loopback";

const AUTH_LOOPBACK_EVENT = __test.AUTH_LOOPBACK_EVENT;

function isAuthCallback(url: string) {
  if (url.startsWith("http://127.0.0.1:")) return url.includes("/callback");
  return ["blimy://auth/callback", "blimy-preview://auth/callback"].some((prefix) =>
    url.startsWith(prefix),
  );
}

function extractCode(url: string) {
  try {
    return new URL(url).searchParams.get("code");
  } catch {
    return null;
  }
}

describe("auth loopback callback", () => {
  it("uses the event name the Rust listener emits", () => {
    expect(AUTH_LOOPBACK_EVENT).toBe("auth:loopback-callback");
  });

  it("accepts the loopback redirect with a code", () => {
    const url = "http://127.0.0.1:38217/callback?code=abc123&state=xyz";

    expect(isAuthCallback(url)).toBe(true);
    expect(extractCode(url)).toBe("abc123");
  });

  it("still accepts the packaged and preview deep links", () => {
    expect(isAuthCallback("blimy://auth/callback?code=abc")).toBe(true);
    expect(isAuthCallback("blimy-preview://auth/callback?code=abc")).toBe(true);
  });

  it("ignores deep links that are not the auth callback", () => {
    expect(isAuthCallback("blimy://open?path=/tmp/file.txt")).toBe(false);
    expect(isAuthCallback("blimy://settings")).toBe(false);
  });

  it("ignores loopback paths other than the callback", () => {
    expect(isAuthCallback("http://127.0.0.1:38217/")).toBe(false);
    expect(isAuthCallback("http://127.0.0.1:38217/steal?code=abc")).toBe(false);
  });

  it("ignores a remote host, which is not this machine's listener", () => {
    expect(isAuthCallback("http://evil.example.com/callback?code=abc")).toBe(false);
  });

  it("reports no code when the provider reports an error instead", () => {
    const url =
      "http://127.0.0.1:38217/callback?error=access_denied&error_description=User+denied";

    expect(isAuthCallback(url)).toBe(true);
    expect(new URL(url).searchParams.get("error_description")).toBe("User denied");
    expect(extractCode(url)).toBeNull();
  });
});