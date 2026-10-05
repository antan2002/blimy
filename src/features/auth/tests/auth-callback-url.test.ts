import { describe, expect, it } from "vite-plus/test";
import { authCallbackUrl, resetAuthCallbackUrlCache, __test__ } from "../lib/auth-callback-url";

/**
 * The OAuth callback has to name the scheme the running build registered, otherwise the
 * OS drops the redirect and sign-in silently never completes. auth-js throws
 * AuthPKCECodeVerifierMissingError when the verifier cannot be read back on exchange, so
 * a wrong scheme is the difference between a working sign-in and no sign-in at all.
 */
describe("auth callback url", () => {
  it("derives the scheme from each build's product name", () => {
    expect(__test__.schemeForProductName("Blimy")).toBe("blimy");
    expect(__test__.schemeForProductName("Blimy Preview")).toBe("blimy-preview");
    expect(__test__.schemeForProductName("Blimy Dev")).toBe("blimy-dev");
  });

  it("normalises case and spacing the way a config author might write them", () => {
    expect(__test__.schemeForProductName("  BLIMY  ")).toBe("blimy");
    expect(__test__.schemeForProductName("Blimy   Preview")).toBe("blimy-preview");
  });

  it("falls back rather than inventing a scheme no build registered", () => {
    expect(__test__.schemeForProductName("Blimy Experimental")).toBe("blimy");
  });

  it("accepts only schemes the deep link listener matches", () => {
    for (const productName of ["Blimy", "Blimy Preview", "Blimy Dev"]) {
      expect(__test__.SUPPORTED_SCHEMES.has(__test__.schemeForProductName(productName))).toBe(true);
    }
  });

  it("builds a callback the deep link listener will recognise", async () => {
    resetAuthCallbackUrlCache();
    const url = await authCallbackUrl();
    expect(url).toMatch(/^(blimy|blimy-dev|blimy-preview):\/\/auth\/callback$/);
  });
});
