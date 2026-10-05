import { describe, expect, it } from "vite-plus/test";
import { resolveExternalBrowserUrl } from "../utils/external-navigation";

describe("resolveExternalBrowserUrl", () => {
  it("accepts http and https links", () => {
    expect(resolveExternalBrowserUrl("https://blimy.dev/docs")).toBe("https://blimy.dev/docs");
    expect(resolveExternalBrowserUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it("accepts mail and phone links", () => {
    expect(resolveExternalBrowserUrl("mailto:hello@blimy.dev")).toBe("mailto:hello@blimy.dev");
    expect(resolveExternalBrowserUrl("tel:+15551234567")).toBe("tel:+15551234567");
  });

  it("resolves protocol-relative links against the app protocol", () => {
    expect(resolveExternalBrowserUrl("//blimy.dev/docs", "https://app.local/")).toBe(
      "https://blimy.dev/docs",
    );
    expect(resolveExternalBrowserUrl("//blimy.dev/docs", "tauri://localhost/")).toBe(
      "https://blimy.dev/docs",
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
