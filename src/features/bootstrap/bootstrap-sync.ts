import { initializeIconThemes } from "@/extensions/icon-themes/icon-theme-initializer";
import { hydrateExtensionSettings } from "@/extensions/settings/extension-settings-store";
import { initializeKeymaps } from "@/features/keymaps/services/keymaps-init";

export function runSynchronousBootstrapSteps() {
  initializeIconThemes();
  initializeKeymaps();
  // Before any extension registers, so contributed settings keep their values.
  hydrateExtensionSettings();
}
