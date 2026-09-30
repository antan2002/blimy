import blimyThemes from "./builtin/blimy.json";
import { toThemeDefinition } from "./theme-file";
import type { ThemeFile } from "./theme-schema";
import type { ThemeDefinition } from "./theme.types";

export type BlimyDefaultThemeType = "dark" | "light";

interface BlimyDefaultTheme {
  id: string;
  type: BlimyDefaultThemeType;
  colors: Record<string, string>;
  syntax: Record<string, string>;
  definition: ThemeDefinition;
}

const blimyThemeFile = blimyThemes as ThemeFile;

function prefixRecord(prefix: string, value: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[`${prefix}${key}`] = entry;
  }
  return result;
}

function toStringRecord(value: object): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      result[key] = entry;
    }
  }
  return result;
}

function buildDefaultTheme(type: BlimyDefaultThemeType): BlimyDefaultTheme {
  const theme = blimyThemeFile.themes.find((entry) => entry.appearance === type);
  if (!theme) {
    throw new Error(`Missing Blimy ${type} default theme`);
  }

  return {
    id: theme.id,
    type,
    colors: toStringRecord(theme.colors),
    syntax: toStringRecord(theme.syntax ?? {}),
    definition: toThemeDefinition(theme),
  };
}

const BLIMY_DEFAULT_THEMES: Record<BlimyDefaultThemeType, BlimyDefaultTheme> = {
  dark: buildDefaultTheme("dark"),
  light: buildDefaultTheme("light"),
};

export function getBlimyDefaultTheme(type: BlimyDefaultThemeType): BlimyDefaultTheme {
  return BLIMY_DEFAULT_THEMES[type];
}

export function getBlimyDefaultCssVariables(type: BlimyDefaultThemeType): Record<string, string> {
  return prefixRecord("--", getBlimyDefaultTheme(type).colors);
}

export function getBlimyDefaultSyntaxTokens(type: BlimyDefaultThemeType): Record<string, string> {
  return prefixRecord("--syntax-", getBlimyDefaultTheme(type).syntax);
}

export function getBlimyDefaultColor(
  type: BlimyDefaultThemeType,
  name: string,
): string | undefined {
  return getBlimyDefaultTheme(type).colors[name];
}

export function getRequiredBlimyDefaultColor(type: BlimyDefaultThemeType, name: string): string {
  const color = getBlimyDefaultColor(type, name);
  if (!color) {
    throw new Error(`Missing Blimy ${type} default color: ${name}`);
  }

  return color;
}

export function getBlimyDefaultSyntaxColor(
  type: BlimyDefaultThemeType,
  name: string,
): string | undefined {
  return getBlimyDefaultTheme(type).syntax[name];
}

export function getRequiredBlimyDefaultSyntaxColor(
  type: BlimyDefaultThemeType,
  name: string,
): string {
  const color = getBlimyDefaultSyntaxColor(type, name);
  if (!color) {
    throw new Error(`Missing Blimy ${type} default syntax color: ${name}`);
  }

  return color;
}
