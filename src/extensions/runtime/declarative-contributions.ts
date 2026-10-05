import { createElement } from "react";
import { keymapRegistry } from "@/features/keymaps/utils/registry";
import { logger } from "@/features/editor/utils/logger";
import { Empty, EmptyDescription, EmptyTitle } from "@/ui/empty";
import { useUIExtensionStore } from "../ui/stores/ui-extension-store";
import type {
  CommandContribution,
  ExtensionManifest,
  KeybindingContribution,
} from "../types/extension-manifest";
import {
  getManifestCommandContributions,
  getManifestKeybindingContributions,
  getManifestUiContributions,
} from "../types/extension-contributions";

/**
 * Declarative manifest contributions (commands, keybindings, sidebar views,
 * toolbar actions) are metadata the package declares without any executable
 * `main` entry. They become real here: commands land in the UI extension store
 * so the command palette lists them, and keybindings land in the keymap
 * registry so the shared keydown handler can dispatch them.
 */

function extensionCommandId(extensionId: string, commandId: string): string {
  return commandId.startsWith(`${extensionId}.`) ? commandId : `${extensionId}.${commandId}`;
}

/** Commands currently backed only by a manifest declaration, not by extension code. */
const declarativeCommandExecutors = new WeakMap<
  (...args: unknown[]) => void | Promise<void>,
  string
>();

/**
 * A declarative command has no handler unless the extension also runs code that
 * registers one. The lookup is deferred so that an extension whose worker
 * registers the same command id later takes over cleanly.
 */
function createDeclarativeExecutor(extensionId: string, contribution: CommandContribution) {
  const commandId = extensionCommandId(extensionId, contribution.command);

  const execute = async (...args: unknown[]) => {
    const registered = useUIExtensionStore.getState().commands.get(commandId);

    if (registered && declarativeCommandExecutors.get(registered.execute) !== commandId) {
      await registered.execute(...args);
      return;
    }

    logger.warn(
      "ExtensionContributions",
      `Command "${commandId}" is declared in the manifest but the integration has no handler. ` +
        `Register it from the extension's main entry to make it runnable.`,
    );
  };

  declarativeCommandExecutors.set(execute, commandId);
  return execute;
}

export function registerDeclarativeCommands(
  extensionId: string,
  manifest: ExtensionManifest,
): string[] {
  const registered: string[] = [];

  for (const contribution of getManifestCommandContributions(manifest)) {
    const id = extensionCommandId(extensionId, contribution.command);

    // An executable extension registers its own handler at runtime; never
    // shadow it with the manifest placeholder.
    if (useUIExtensionStore.getState().commands.has(id)) continue;

    const execute = createDeclarativeExecutor(extensionId, contribution);

    // The UI store feeds the command palette; the keymap registry feeds the
    // shared keydown handler, toolbar actions, and anything else that dispatches
    // by id. A command only in one of them is invisible to the other.
    useUIExtensionStore.getState().actions.registerCommand({
      id,
      extensionId,
      title: contribution.title,
      category: contribution.category,
      execute,
    });

    keymapRegistry.registerCommand({
      id,
      title: contribution.title,
      category: contribution.category,
      execute,
    });

    registered.push(id);
  }

  return registered;
}

export function registerDeclarativeKeybindings(
  extensionId: string,
  manifest: ExtensionManifest,
): number {
  const commandIds = new Set(
    getManifestCommandContributions(manifest).map((contribution) =>
      extensionCommandId(extensionId, contribution.command),
    ),
  );

  let registered = 0;

  for (const contribution of getManifestKeybindingContributions(manifest)) {
    const commandId = extensionCommandId(extensionId, contribution.command);
    if (!commandIds.has(commandId)) {
      logger.warn(
        "ExtensionContributions",
        `Keybinding "${contribution.key}" targets "${commandId}", which ${extensionId} does not declare.`,
      );
      continue;
    }

    keymapRegistry.registerKeybinding({
      key: contribution.key,
      command: commandId,
      when: contribution.when,
      source: "extension",
      enabled: true,
    });
    registered++;
  }

  return registered;
}

export function unregisterDeclarativeContributions(extensionId: string): void {
  const actions = useUIExtensionStore.getState().actions;

  for (const [id, command] of useUIExtensionStore.getState().commands) {
    if (command.extensionId !== extensionId) continue;
    actions.unregisterCommand(id);
    keymapRegistry.unregisterKeybinding(id);
    keymapRegistry.unregisterCommand(id);
  }

  for (const [id, action] of useUIExtensionStore.getState().toolbarActions) {
    if (action.extensionId === extensionId) {
      actions.unregisterToolbarAction(id);
    }
  }

  for (const [id, view] of useUIExtensionStore.getState().sidebarViews) {
    if (view.extensionId === extensionId) {
      actions.unregisterSidebarView(id);
    }
  }
}

export interface DeclarativeUiCounts {
  sidebarViews: number;
  toolbarActions: number;
  menus: number;
  orphanedToolbarActions: string[];
}

export function registerDeclarativeUiContributions(
  extensionId: string,
  manifest: ExtensionManifest,
): DeclarativeUiCounts {
  const { sidebarViews, toolbarActions, menus } = getManifestUiContributions(manifest);
  const actions = useUIExtensionStore.getState().actions;
  const commandIds = new Set(
    getManifestCommandContributions(manifest).map((contribution) =>
      extensionCommandId(extensionId, contribution.command),
    ),
  );
  const orphanedToolbarActions: string[] = [];

  // A sidebar view the manifest declares but never renders would be a dead
  // entry in the activity bar, so it is only registered when the extension
  // already supplied a real view for it.
  const registeredSidebarViews: string[] = [];

  for (const contribution of sidebarViews) {
    const id = extensionCommandId(extensionId, contribution.id);
    if (useUIExtensionStore.getState().sidebarViews.has(id)) continue;

    actions.registerSidebarView({
      id,
      extensionId,
      title: contribution.title,
      icon: contribution.icon,
      render: () =>
        createElement(
          Empty,
          { variant: "region" },
          createElement(EmptyTitle, null, contribution.title),
          createElement(
            EmptyDescription,
            null,
            "This view is declared by the extension but has no renderer yet.",
          ),
        ),
    });

    registeredSidebarViews.push(id);
  }

  for (const contribution of toolbarActions) {
    const commandId = extensionCommandId(extensionId, contribution.command);
    if (!commandIds.has(commandId)) {
      orphanedToolbarActions.push(contribution.id);
      continue;
    }

    actions.registerToolbarAction({
      id: extensionCommandId(extensionId, contribution.id),
      extensionId,
      title: contribution.title,
      icon: contribution.icon,
      position: contribution.position,
      onClick: () => {
        void keymapRegistry.executeCommand(commandId);
      },
    });
  }

  // Menus carry no state of their own: their items resolve against the command
  // set, so a declared menu is honoured as soon as its commands are runnable.
  for (const contribution of menus) {
    const undeclared = contribution.items.filter(
      (item) => !commandIds.has(extensionCommandId(extensionId, item.command)),
    );

    if (undeclared.length > 0) {
      logger.warn(
        "ExtensionContributions",
        `Menu "${contribution.id}" from ${extensionId} references undeclared commands: ` +
          undeclared.map((item) => item.command).join(", "),
      );
    }
  }

  return {
    sidebarViews: registeredSidebarViews.length,
    toolbarActions: toolbarActions.length - orphanedToolbarActions.length,
    menus: menus.length,
    orphanedToolbarActions,
  };
}

export function getDeclarativeKeybindingCount(manifest: ExtensionManifest): number {
  return getManifestKeybindingContributions(manifest).length;
}

export type { KeybindingContribution };
