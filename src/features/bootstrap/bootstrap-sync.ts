import { initializeIconThemes } from "@/extensions/icon-themes/icon-theme-initializer";
import { initializeKeymaps } from "@/features/keymaps/services/keymaps-init";
import { migrateLegacyStorageKeys } from "@/features/bootstrap/migrate-legacy-storage-keys";

export function runSynchronousBootstrapSteps() {
  // Runs first so every later step reads the renamed keys.
  migrateLegacyStorageKeys();
  initializeIconThemes();
  initializeKeymaps();
}
