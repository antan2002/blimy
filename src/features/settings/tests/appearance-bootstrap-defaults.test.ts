import { describe, expect, it } from "vite-plus/test";
import {
  getBlimyDefaultColor,
  getBlimyDefaultSyntaxColor,
} from "@/extensions/themes/default-theme";
import {
  BLIMY_BOOTSTRAP_DEFAULTS,
  DEFAULT_APPEARANCE_BOOTSTRAP_CACHE,
} from "../lib/appearance-bootstrap";

describe("appearance bootstrap defaults", () => {
  it("uses the bundled Blimy dark theme for startup CSS variables", () => {
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.themeId).toBe("blimy-dark");
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.themeType).toBe("dark");
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.windowTransparency).toBe(false);
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.cssVariables["--background"]).toBe(
      getBlimyDefaultColor("dark", "background"),
    );
    expect(DEFAULT_APPEARANCE_BOOTSTRAP_CACHE.syntaxTokens["--syntax-keyword"]).toBe(
      getBlimyDefaultSyntaxColor("dark", "keyword"),
    );
  });

  it("keeps bootstrap theme metadata aligned with Blimy defaults", () => {
    expect(BLIMY_BOOTSTRAP_DEFAULTS.light.colors.background).toBe(
      getBlimyDefaultColor("light", "background"),
    );
    expect(BLIMY_BOOTSTRAP_DEFAULTS.dark.syntax.keyword).toBe(
      getBlimyDefaultSyntaxColor("dark", "keyword"),
    );
  });
});
