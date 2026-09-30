import { describe, expect, it } from "vite-plus/test";
import { resolveExternalBrowserUrl } from "../utils/external-navigation";

describe("resolveExternalBrowserUrl", () => {
  it("accepts http and https links", () => {
    expect(resolveExternalBrowserUrl("https://github.com/antan2002/blimy/docs")).toBe("https://github.com/antan2002/blimy/docs");
    expect(resolveExternalBrowserUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it("accepts mail and phone links", () => {
    expect(resolveExternalBrowserUrl("mailto:hello@github.com/antan2002/blimy")).toBe("mailto:hello@github.com/antan2002/blimy");
    expect(resolveExternalBrowserUrl("tel:+15551234567")).toBe("tel:+15551234567");
  });

  it("resolves protocol-relative links against the app protocol", () => {
    expect(resolveExternalBrowserUrl("//github.com/antan2002/blimy/docs", "https://app.local/")).toBe(
      "https://github.com/antan2002/blimy/docs",
    );
    expect(resolveExternalBrowserUrl("//github.com/antan2002/blimy/docs", "tauri://localhost/")).toBe(
      "https://github.com/antan2002/blimy/docs",
    );
  });

  it("does not treat in-app relative links as external", () => {
    expect(resolveExternalBrowserUrl("/settings", "http://localhost/")).toBe(null);
    expect(resolveExternalBrowserUrl("#section", "http://localhost/")).toBe(null);
  });

  it("rejects unsupported protocols", () => {
    expect(resolveExternalBrowserUrl("javascript:alert(1)")).toBe(null);
    expect(resolveExternalBrowserUrl("file:///Users/test/readme.md")).toBe(null);
    expect(resolveExternalBrowserUrl("blimy://open?path=/tmp/test.md")).toBe(null);
  });
});
