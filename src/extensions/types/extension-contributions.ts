import type {
  CommandContribution,
  ConfigurationProperty,
  DatabaseProviderContribution,
  ExtensionManifest,
  AIProviderContribution,
  IconThemeContribution,
  IntegrationContribution,
  KeybindingContribution,
  LanguageContribution,
  Platform,
  SidebarViewContribution,
  SkillContribution,
  Snippet,
  SnippetContribution,
  ThemeContribution,
  ToolbarActionContribution,
  MenuContribution,
} from "./extension-manifest";

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function normalizeExtensions(extensions: string[]): string[] {
  return extensions.map((extension) => (extension.startsWith(".") ? extension : `.${extension}`));
}

function cloneLanguageContribution(language: LanguageContribution): LanguageContribution {
  return {
    ...language,
    extensions: normalizeExtensions(language.extensions || []),
    aliases: language.aliases ? [...language.aliases] : undefined,
    filenames: language.filenames ? [...language.filenames] : undefined,
    filenamePatterns: language.filenamePatterns ? [...language.filenamePatterns] : undefined,
  };
}

export function getManifestLanguageContributions(
  manifest: ExtensionManifest,
): LanguageContribution[] {
  return uniqueBy(
    [...(manifest.languages || []), ...(manifest.contributes?.languages || [])].map(
      cloneLanguageContribution,
    ),
    (language) => language.id,
  );
}

export function getManifestCommandContributions(
  manifest: ExtensionManifest,
): CommandContribution[] {
  return uniqueBy(
    [...(manifest.commands || []), ...(manifest.contributes?.commands || [])],
    (command) => command.command,
  );
}

export function getManifestKeybindingContributions(
  manifest: ExtensionManifest,
): KeybindingContribution[] {
  const contributions = [
    ...(manifest.keybindings || []),
    ...(manifest.contributes?.keybindings || []),
  ];

  const seen = new Set<string>();
  const result: KeybindingContribution[] = [];

  for (const contribution of contributions) {
    for (const key of platformSpecificKeys(contribution)) {
      const dedupeKey = `${contribution.command}|${key}|${contribution.when ?? ""}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      result.push({ ...contribution, key });
    }
  }

  return result;
}

// A manifest may give one binding plus per-platform overrides. The override for
// the running platform replaces `key` outright, matching VS Code: a `cmd` key
// on macOS must not leave the `ctrl` binding active alongside it.
function platformSpecificKeys(contribution: KeybindingContribution): string[] {
  const platform = getPlatformKey();

  const override =
    platform === "darwin"
      ? contribution.mac
      : platform === "win32"
        ? contribution.win
        : contribution.linux;

  const effective = override || contribution.key;
  return effective ? [effective] : [];
}

function getPlatformKey(): Platform {
  if (typeof navigator === "undefined") return "linux";
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes("mac")) return "darwin";
  if (agent.includes("win")) return "win32";
  return "linux";
}

export function getManifestUiContributions(manifest: ExtensionManifest): {
  sidebarViews: SidebarViewContribution[];
  toolbarActions: ToolbarActionContribution[];
  menus: MenuContribution[];
} {
  return {
    sidebarViews: manifest.contributes?.sidebarViews ?? [],
    toolbarActions: manifest.contributes?.toolbarActions ?? [],
    menus: manifest.contributes?.menus ?? [],
  };
}

function getManifestSnippetContributions(manifest: ExtensionManifest): SnippetContribution[] {
  return [...(manifest.snippets || []), ...(manifest.contributes?.snippets || [])];
}

export function getManifestDatabaseContributions(
  manifest: ExtensionManifest,
): DatabaseProviderContribution[] {
  return [
    ...(manifest.databases || []),
    ...(manifest.databaseProviders || []),
    ...(manifest.contributes?.databases || []),
    ...(manifest.contributes?.databaseProviders || []),
  ];
}

export function getManifestAIProviderContributions(
  manifest: ExtensionManifest,
): AIProviderContribution[] {
  return [...(manifest.aiProviders || []), ...(manifest.contributes?.aiProviders || [])];
}

export function getManifestIntegrationContributions(
  manifest: ExtensionManifest,
): IntegrationContribution[] {
  return uniqueBy(
    [...(manifest.integrations || []), ...(manifest.contributes?.integrations || [])],
    (integration) => integration.id,
  );
}

export function getManifestSkillContributions(manifest: ExtensionManifest): SkillContribution[] {
  return uniqueBy(
    [...(manifest.skills || []), ...(manifest.contributes?.skills || [])],
    (skill) => skill.id,
  );
}

export function getManifestThemeContributions(manifest: ExtensionManifest): ThemeContribution[] {
  return [...(manifest.themes || []), ...(manifest.contributes?.themes || [])];
}

export function getManifestIconContributions(manifest: ExtensionManifest): IconThemeContribution[] {
  return [
    ...(manifest.icons || []),
    ...(manifest.iconThemes || []),
    ...(manifest.contributes?.icons || []),
    ...(manifest.contributes?.iconThemes || []),
  ];
}

export function getManifestInlineSnippets(manifest: ExtensionManifest): Array<{
  language: string;
  prefix: string;
  body: string | string[];
  description?: string;
  scope?: string;
}> {
  const snippets: Array<{
    language: string;
    prefix: string;
    body: string | string[];
    description?: string;
    scope?: string;
  }> = [];

  for (const snippetContribution of getManifestSnippetContributions(manifest)) {
    for (const snippet of snippetContribution.snippets || []) {
      snippets.push({
        language: snippetContribution.language,
        ...(snippet as Snippet),
      });
    }
  }

  return snippets;
}

export interface RegisteredConfigurationProperty extends ConfigurationProperty {
  extensionId: string;
  /** Namespaced key, so two extensions cannot claim the same setting. */
  qualifiedKey: string;
}

export function getManifestConfigurationProperties(
  manifest: ExtensionManifest,
): RegisteredConfigurationProperty[] {
  const properties = [...(manifest.configuration || []), ...(manifest.contributes?.configuration || [])];
  const seen = new Set<string>();
  const result: RegisteredConfigurationProperty[] = [];

  for (const property of properties) {
    const qualifiedKey = `${manifest.id}.${property.key}`;
    if (seen.has(qualifiedKey)) continue;
    seen.add(qualifiedKey);
    result.push({ ...property, extensionId: manifest.id, qualifiedKey });
  }

  return result;
}

export function getManifestActivationEvents(manifest: ExtensionManifest): string[] {
  if (manifest.activationEvents?.length) {
    return [...manifest.activationEvents];
  }

  return getManifestLanguageContributions(manifest).map((language) => `onLanguage:${language.id}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function filenamePatternToRegExp(pattern: string): RegExp {
  const source = Array.from(pattern)
    .map((character) => {
      if (character === "*") return ".*";
      if (character === "?") return ".";
      return escapeRegExp(character);
    })
    .join("");

  return new RegExp(`^${source}$`);
}

export function matchesLanguageContribution(
  filePath: string,
  language: LanguageContribution,
): boolean {
  const fileName = filePath.split(/[\\/]/).pop() || filePath;

  if (language.filenames?.includes(fileName)) {
    return true;
  }

  if (
    language.filenamePatterns?.some((pattern) => filenamePatternToRegExp(pattern).test(fileName))
  ) {
    return true;
  }

  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return false;
  }

  const fileExt = fileName.substring(lastDotIndex).toLowerCase();
  return language.extensions.some((extension) => extension.toLowerCase() === fileExt);
}
