import { describe, expect, it } from "vite-plus/test";
import type { ExtensionManifest } from "@/extensions/types/extension-manifest";
import {
  getManifestAIProviderContributions,
  getManifestCommandContributions,
  getManifestConfigurationProperties,
  getManifestDatabaseContributions,
  getManifestIconContributions,
  getManifestIntegrationContributions,
  getManifestActivationEvents,
  getManifestKeybindingContributions,
  getManifestLanguageContributions,
  getManifestSkillContributions,
  getManifestUiContributions,
  matchesLanguageContribution,
} from "@/extensions/types/extension-contributions";

function createManifest(overrides: Partial<ExtensionManifest> = {}): ExtensionManifest {
  return {
    id: "blimy.test",
    name: "Test",
    displayName: "Test",
    description: "Test integration",
    version: "1.0.0",
    publisher: "Blimy",
    categories: ["Language"],
    ...overrides,
  };
}

describe("integration contribution normalization", () => {
  it("reads languages from manifest contributes blocks", () => {
    const manifest = createManifest({
      contributes: {
        languages: [
          {
            id: "jsonc",
            extensions: [],
            filenames: ["tsconfig.json"],
            filenamePatterns: ["tsconfig.*.json"],
          },
        ],
      },
    });

    const languages = getManifestLanguageContributions(manifest);

    expect(languages).toHaveLength(1);
    expect(languages[0].id).toBe("jsonc");
    expect(matchesLanguageContribution("/repo/tsconfig.json", languages[0])).toBe(true);
    expect(matchesLanguageContribution("/repo/tsconfig.app.json", languages[0])).toBe(true);
  });

  it("keeps explicit activation events and otherwise derives language activation events", () => {
    expect(
      getManifestActivationEvents(
        createManifest({
          languages: [{ id: "typescript", extensions: [".ts"] }],
        }),
      ),
    ).toEqual(["onLanguage:typescript"]);

    expect(
      getManifestActivationEvents(
        createManifest({
          activationEvents: ["onCommand:test.run"],
          languages: [{ id: "typescript", extensions: [".ts"] }],
        }),
      ),
    ).toEqual(["onCommand:test.run"]);
  });

  it("matches compound filenames by their final extension", () => {
    expect(
      matchesLanguageContribution("/repo/src/routes/+page.svelte.ts", {
        id: "typescript",
        extensions: [".ts", ".mts", ".cts"],
      }),
    ).toBe(true);

    expect(
      matchesLanguageContribution("/repo/src/routes/+page.svelte.ts", {
        id: "svelte",
        extensions: [".svelte"],
      }),
    ).toBe(false);
  });

  it("reads database contributions from the new databases field", () => {
    const manifest = createManifest({
      categories: ["Database"],
      databases: [
        {
          id: "duckdb",
          label: "DuckDB",
          isFileBased: true,
          protocolVersion: 1,
          sidecar: { "darwin-arm64": "bin/blimy-db-duckdb" },
        },
      ],
    });

    expect(getManifestDatabaseContributions(manifest).map((database) => database.id)).toEqual([
      "duckdb",
    ]);
  });

  it("reads icon contributions from the new icons field", () => {
    const manifest = createManifest({
      categories: ["Icon Theme"],
      contributes: {
        icons: [
          {
            id: "market",
            name: "Market",
            iconDefinitions: {},
          },
        ],
      },
    });

    expect(getManifestIconContributions(manifest).map((icon) => icon.id)).toEqual(["market"]);
  });

  it("reads AI provider contributions", () => {
    const manifest = createManifest({
      categories: ["AI"],
      contributes: {
        aiProviders: [
          {
            id: "v0",
            name: "v0",
            apiUrl: "https://api.v0.dev/v1/chats",
            requiresApiKey: true,
            models: [{ id: "v0-auto", name: "v0 Auto", maxTokens: 50000 }],
          },
        ],
      },
    });

    expect(getManifestAIProviderContributions(manifest).map((provider) => provider.id)).toEqual([
      "v0",
    ]);
  });

  it("deduplicates integration contributions across manifest shapes", () => {
    const manifest = createManifest({
      categories: ["Integration"],
      integrations: [{ id: "gitlab", name: "GitLab", kind: "code-host" }],
      contributes: {
        integrations: [{ id: "gitlab", name: "GitLab", kind: "code-host" }],
      },
    });

    expect(getManifestIntegrationContributions(manifest)).toEqual([
      { id: "gitlab", name: "GitLab", kind: "code-host" },
    ]);
  });

  it("reads skill contributions from integration manifests", () => {
    const manifest = createManifest({
      contributes: {
        skills: [
          {
            id: "blimy.review",
            name: "Review",
            description: "Review code changes",
            path: "SKILL.md",
            tags: ["review"],
          },
        ],
      },
    });

    expect(getManifestSkillContributions(manifest)).toEqual([
      {
        id: "blimy.review",
        name: "Review",
        description: "Review code changes",
        path: "SKILL.md",
        tags: ["review"],
      },
    ]);
  });

  it("reads declarative commands from both manifest shapes and dedupes them", () => {
    const command = { command: "blimy.test.doThing", title: "Do Thing" };
    const manifest = createManifest({
      commands: [command],
      contributes: { commands: [command] },
    });

    expect(getManifestCommandContributions(manifest)).toEqual([command]);
  });

  it("replaces the base binding with the running platform's override", () => {
    const manifest = createManifest({
      keybindings: [
        {
          command: "blimy.test.doThing",
          key: "ctrl+shift+t",
          mac: "cmd+shift+t",
          linux: "ctrl+alt+t",
          win: "ctrl+shift+alt+t",
        },
      ],
    });

    const keys = getManifestKeybindingContributions(manifest).map((binding) => binding.key);

    // Exactly one binding survives: the platform override when there is one,
    // otherwise the base. Leaving the base active beside `cmd` on macOS is
    // what VS Code avoids, so both must never be bound at once.
    expect(keys).toHaveLength(1);
    expect(["ctrl+shift+t", "cmd+shift+t", "ctrl+alt+t", "ctrl+shift+alt+t"]).toContain(keys[0]);
  });

  it("falls back to the base binding on a platform with no override", () => {
    const manifest = createManifest({
      keybindings: [
        {
          command: "blimy.test.doThing",
          key: "ctrl+shift+t",
          mac: "cmd+shift+t",
        },
      ],
    });

    const keys = getManifestKeybindingContributions(manifest).map((binding) => binding.key);

    expect(keys).toHaveLength(1);
    expect(["ctrl+shift+t", "cmd+shift+t"]).toContain(keys[0]);
  });

  it("keeps a base-only binding unchanged", () => {
    const manifest = createManifest({
      keybindings: [{ command: "blimy.test.doThing", key: "ctrl+shift+t" }],
    });

    expect(getManifestKeybindingContributions(manifest).map((binding) => binding.key)).toEqual([
      "ctrl+shift+t",
    ]);
  });

  it("skips a keybinding override that the manifest leaves empty", () => {
    const manifest = createManifest({
      keybindings: [{ command: "blimy.test.doThing", key: "ctrl+shift+t", win: "" }],
    });

    const keys = getManifestKeybindingContributions(manifest).map((binding) => binding.key);

    expect(keys).toEqual(["ctrl+shift+t"]);
  });

  it("reads declarative UI contributions", () => {
    const manifest = createManifest({
      contributes: {
        sidebarViews: [{ id: "blimy.test.view", title: "View", icon: "puzzle-piece" }],
        toolbarActions: [
          {
            id: "blimy.test.action",
            title: "Action",
            icon: "puzzle-piece",
            command: "blimy.test.doThing",
            position: "right",
          },
        ],
        menus: [{ id: "blimy.test.menu", items: [{ command: "blimy.test.doThing" }] }],
      },
    });

    const ui = getManifestUiContributions(manifest);

    expect(ui.sidebarViews).toHaveLength(1);
    expect(ui.toolbarActions).toHaveLength(1);
    expect(ui.menus[0].items[0].command).toBe("blimy.test.doThing");
  });

  it("namespaces contributed settings under the contributing extension", () => {
    const manifest = createManifest({
      configuration: [{ key: "endpoint", type: "string", default: "https://example.com" }],
      contributes: {
        configuration: [{ key: "endpoint", type: "string", default: "https://ignored" }],
      },
    });

    const properties = getManifestConfigurationProperties(manifest);

    expect(properties).toHaveLength(1);
    expect(properties[0].qualifiedKey).toBe("blimy.test.endpoint");
    expect(properties[0].default).toBe("https://example.com");
  });
});
