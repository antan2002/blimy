import { reportBootstrapResults } from "./bootstrap-errors";

const foundationalBootstrapSteps = [
  {
    name: "settings store",
    run: async () => {
      const { initializeSettingsStore } = await import("@/features/settings/stores/settings.store");
      await initializeSettingsStore();
    },
  },
  {
    name: "theme system",
    run: async () => {
      const { initializeThemeSystem } = await import("@/extensions/themes/theme-initializer");
      await initializeThemeSystem();
    },
  },
  {
    name: "telemetry",
    run: async () => {
      const { initializeTelemetry } = await import("@/features/telemetry/services/telemetry");
      await initializeTelemetry();
    },
  },
  {
    // Restores a saved session from the keychain. Runs with the other foundational
    // steps and must never reject: a signed-out editor is a valid state, so a failure
    // here degrades to signed out rather than blocking startup.
    name: "auth store",
    run: async () => {
      const { useAuthStore } = await import("@/features/window/stores/auth.store");
      await useAuthStore.getState().actions.initialize();
    },
  },
] as const;

const extensionBootstrapSteps = [
  {
    name: "integration runtime",
    run: async () => {
      const { initializeExtensionRuntime } = await import("@/extensions/runtime/extension-runtime");
      await initializeExtensionRuntime();
    },
  },
] as const;

export async function runAsyncBootstrapSteps(): Promise<void> {
  const foundationalResults = await Promise.allSettled(
    foundationalBootstrapSteps.map((step) => step.run()),
  );
  reportBootstrapResults(foundationalBootstrapSteps, foundationalResults);

  const extensionResults = await Promise.allSettled(
    extensionBootstrapSteps.map((step) => step.run()),
  );
  reportBootstrapResults(extensionBootstrapSteps, extensionResults);
}
