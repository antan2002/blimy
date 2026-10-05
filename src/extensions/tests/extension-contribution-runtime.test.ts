import { enableMapSet } from "immer";
import { describe, expect, it } from "vite-plus/test";
import { keymapRegistry } from "@/features/keymaps/utils/registry";
import { getExtensionSetting } from "../settings/extension-settings-store";
import {
  activateExtensionContributions,
  deactivateExtensionContributions,
  isExtensionContributionActive,
} from "../runtime/extension-contribution-runtime";
import { themeRegistry } from "../themes/theme-registry";
import type { ExtensionManifest } from "../types/extension-manifest";
import { useUIExtensionStore } from "../ui/stores/ui-extension-store";

enableMapSet();

const extensionId = "blimy.runtime-lifecycle-test";
const themeId = "runtime-lifecycle-test";
const manifest: ExtensionManifest = {
  id: extensionId,
  name: "Runtime lifecycle test",
  displayName: "Runtime lifecycle test",
  description: "Exercises contribution activation ownership",
  version: "1.0.0",
  publisher: "Blimy",
  categories: ["Theme"],
  themes: [
    {
      id: themeId,
      name: "Runtime lifecycle test",
      appearance: "dark",
      colors: {},
    },
  ],
};

describe("extension contribution runtime", () => {
  it("activates each extension exactly once and releases owned contributions", async () => {
    await deactivateExtensionContributions(extensionId, manifest);
    const versionBeforeActivation = themeRegistry.getVersion();

    await Promise.all([
      activateExtensionContributions(extensionId, manifest),
      activateExtensionContributions(extensionId, manifest),
    ]);

    expect(themeRegistry.getVersion()).toBe(versionBeforeActivation + 1);
    expect(themeRegistry.getThemeSource(themeId)?.extensionId).toBe(extensionId);
    expect(isExtensionContributionActive(extensionId)).toBe(true);

    await deactivateExtensionContributions(extensionId, manifest);

    expect(themeRegistry.getTheme(themeId)).toBeUndefined();
    expect(isExtensionContributionActive(extensionId)).toBe(false);
  });

  it("registers and releases declarative commands, keybindings, and settings", async () => {
    const declarativeId = "blimy.declarative-test";
    const declarativeManifest: ExtensionManifest = {
      ...manifest,
      id: declarativeId,
      categories: ["Integration"],
      themes: undefined,
      commands: [{ command: "blimy.declarative-test.run", title: "Run" }],
      keybindings: [{ command: "blimy.declarative-test.run", key: "ctrl+shift+y" }],
      contributes: {
        configuration: [{ key: "endpoint", type: "string", default: "https://seed" }],
      },
    };

    await deactivateExtensionContributions(declarativeId, declarativeManifest);
    await activateExtensionContributions(declarativeId, declarativeManifest);

    const commands = useUIExtensionStore.getState().commands;
    expect(commands.has("blimy.declarative-test.run")).toBe(true);

    // The keymap registry is what the shared keydown handler and toolbar
    // actions dispatch through, so a command missing here would be inert.
    expect(keymapRegistry.getCommand("blimy.declarative-test.run")).toBeDefined();

    const bindings = keymapRegistry
      .getAllKeybindings()
      .filter((binding) => binding.command === "blimy.declarative-test.run");
    expect(bindings).toHaveLength(1);
    expect(bindings[0].source).toBe("extension");

    expect(getExtensionSetting("blimy.declarative-test.endpoint")).toBe("https://seed");

    await deactivateExtensionContributions(declarativeId, declarativeManifest);

    expect(useUIExtensionStore.getState().commands.has("blimy.declarative-test.run")).toBe(false);
    expect(keymapRegistry.getCommand("blimy.declarative-test.run")).toBeUndefined();
    expect(
      keymapRegistry
        .getAllKeybindings()
        .some((binding) => binding.command === "blimy.declarative-test.run"),
    ).toBe(false);
    expect(getExtensionSetting("blimy.declarative-test.endpoint")).toBeUndefined();
  });

  it("registers a declared sidebar view and releases it on deactivation", async () => {
    const viewId = "blimy.sidebar-view-test";
    const viewManifest: ExtensionManifest = {
      ...manifest,
      id: viewId,
      categories: ["Integration"],
      themes: undefined,
      commands: [{ command: `${viewId}.run`, title: "Run" }],
      contributes: {
        sidebarViews: [{ id: `${viewId}.panel`, title: "Panel", icon: "puzzle-piece" }],
      },
    };

    await deactivateExtensionContributions(viewId, viewManifest);
    await activateExtensionContributions(viewId, viewManifest);

    const views = useUIExtensionStore.getState().sidebarViews;
    expect(views.get(`${viewId}.panel`)?.title).toBe("Panel");

    await deactivateExtensionContributions(viewId, viewManifest);

    expect(useUIExtensionStore.getState().sidebarViews.has(`${viewId}.panel`)).toBe(false);
  });

  it("skips a toolbar action whose command the manifest never declares", async () => {
    const orphanedId = "blimy.orphan-toolbar-test";
    const orphanedManifest: ExtensionManifest = {
      ...manifest,
      id: orphanedId,
      categories: ["Integration"],
      themes: undefined,
      commands: [{ command: "blimy.orphan-toolbar-test.run", title: "Run" }],
      contributes: {
        toolbarActions: [
          {
            id: "blimy.orphan-toolbar-test.missing",
            title: "Missing",
            icon: "puzzle-piece",
            command: "blimy.orphan-toolbar-test.notDeclared",
            position: "right",
          },
          {
            id: "blimy.orphan-toolbar-test.present",
            title: "Present",
            icon: "puzzle-piece",
            command: "blimy.orphan-toolbar-test.run",
            position: "right",
          },
        ],
      },
    };

    await deactivateExtensionContributions(orphanedId, orphanedManifest);
    await activateExtensionContributions(orphanedId, orphanedManifest);

    const toolbar = useUIExtensionStore.getState().toolbarActions;
    expect(toolbar.has("blimy.orphan-toolbar-test.present")).toBe(true);
    expect(toolbar.has("blimy.orphan-toolbar-test.missing")).toBe(false);

    await deactivateExtensionContributions(orphanedId, orphanedManifest);
  });
});
