import { describe, expect, it } from "vite-plus/test";
import BlimyThemes from "@/extensions/themes/builtin/Blimy.json";
import {
  getBlimyDefaultColor,
  getBlimyDefaultCssVariables,
  getBlimyDefaultSyntaxColor,
  getBlimyDefaultSyntaxTokens,
  getBlimyDefaultTheme,
  getRequiredBlimyDefaultColor,
  getRequiredBlimyDefaultSyntaxColor,
} from "@/extensions/themes/default-theme";
import type { ThemeFile } from "@/extensions/themes/theme-schema";

const themeFile = BlimyThemes as ThemeFile;

describe("Blimy default themes", () => {
  it("uses bundled Blimy.json as the canonical default theme source", () => {
    const bundledDark = themeFile.themes.find((theme) => theme.id === "blimy-dark");
    const bundledLight = themeFile.themes.find((theme) => theme.id === "blimy-light");

    expect(getBlimyDefaultTheme("dark").colors).toEqual(bundledDark?.colors);
    expect(getBlimyDefaultTheme("light").syntax).toEqual(bundledLight?.syntax);
  });

  it("builds prefixed CSS and syntax variables from the same defaults", () => {
    expect(getBlimyDefaultCssVariables("dark")["--background"]).toBe(
      getBlimyDefaultColor("dark", "background"),
    );
    expect(getBlimyDefaultSyntaxTokens("dark")["--syntax-keyword"]).toBe(
      getBlimyDefaultSyntaxColor("dark", "keyword"),
    );
  });

  it("requires bundled default color names to exist", () => {
    expect(getRequiredBlimyDefaultColor("dark", "terminal-bright-blue")).toBe(
      getBlimyDefaultColor("dark", "terminal-bright-blue"),
    );
    expect(getRequiredBlimyDefaultSyntaxColor("light", "keyword")).toBe(
      getBlimyDefaultSyntaxColor("light", "keyword"),
    );
    expect(() => getRequiredBlimyDefaultColor("dark", "missing-color")).toThrow(
      "Missing Blimy dark default color: missing-color",
    );
  });

  it("exposes canonical raw theme variables without runtime aliases", () => {
    const definition = getBlimyDefaultTheme("light").definition;

    expect(definition.cssVariables["--background"]).toBe(
      getBlimyDefaultColor("light", "background"),
    );
    expect(definition.cssVariables["--color-background"]).toBeUndefined();
    expect(definition.syntaxTokens?.["--syntax-keyword"]).toBe(
      getBlimyDefaultSyntaxColor("light", "keyword"),
    );
    expect(definition.syntaxTokens?.["--color-syntax-keyword"]).toBeUndefined();
  });
});
