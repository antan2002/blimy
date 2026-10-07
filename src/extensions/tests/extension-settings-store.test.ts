import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  forgetExtensionConfiguration,
  getExtensionSetting,
  hydrateExtensionSettings,
  registerExtensionConfiguration,
  resetExtensionSetting,
  setExtensionSetting,
  subscribeToExtensionSettings,
  unregisterExtensionConfiguration,
} from "@/extensions/settings/extension-settings-store";
import type { ExtensionManifest } from "@/extensions/types/extension-manifest";

// The suite runs without a DOM, so localStorage is stubbed in memory.
function createMemoryStorage() {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => entries.clear(),
  };
}

const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: createMemoryStorage(),
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: originalLocalStorage,
  });
});

function createManifest(
  id: string,
  configuration: NonNullable<ExtensionManifest["configuration"]>,
): ExtensionManifest {
  return {
    id,
    name: id,
    displayName: id,
    description: id,
    version: "1.0.0",
    publisher: "Blimy",
    categories: ["Integration"],
    configuration,
  };
}

describe("extension contributed settings", () => {
  it("seeds a declared default so the extension never reads undefined", () => {
    registerExtensionConfiguration(
      createManifest("blimy.alpha", [{ key: "endpoint", type: "string", default: "https://a" }]),
    );

    expect(getExtensionSetting("blimy.alpha.endpoint")).toBe("https://a");

    unregisterExtensionConfiguration("blimy.alpha");
  });

  it("stores an override and restores the declared default on reset", () => {
    registerExtensionConfiguration(
      createManifest("blimy.beta", [{ key: "retries", type: "integer", default: 3 }]),
    );

    setExtensionSetting("blimy.beta.retries", 9);
    expect(getExtensionSetting("blimy.beta.retries")).toBe(9);

    resetExtensionSetting("blimy.beta.retries");
    expect(getExtensionSetting("blimy.beta.retries")).toBe(3);

    unregisterExtensionConfiguration("blimy.beta");
  });

  it("ignores writes to a setting no extension declared", () => {
    registerExtensionConfiguration(
      createManifest("blimy.gamma", [{ key: "known", type: "boolean", default: false }]),
    );

    setExtensionSetting("blimy.unknown", "value");

    expect(getExtensionSetting("blimy.unknown")).toBeUndefined();

    unregisterExtensionConfiguration("blimy.gamma");
  });

  it("stops serving a setting when the extension is disabled", () => {
    registerExtensionConfiguration(
      createManifest("blimy.delta", [{ key: "token", type: "string", default: "seed" }]),
    );

    unregisterExtensionConfiguration("blimy.delta");

    expect(getExtensionSetting("blimy.delta.token")).toBeUndefined();
  });

  it("drops an extension's settings when it is uninstalled", () => {
    registerExtensionConfiguration(
      createManifest("blimy.theta", [{ key: "token", type: "string", default: "seed" }]),
    );
    setExtensionSetting("blimy.theta.token", "user-value");

    forgetExtensionConfiguration("blimy.theta");

    expect(getExtensionSetting("blimy.theta.token")).toBeUndefined();
  });

  it("restores a stored value after the extension is re-enabled", () => {
    registerExtensionConfiguration(
      createManifest("blimy.zeta", [{ key: "retries", type: "integer", default: 3 }]),
    );
    setExtensionSetting("blimy.zeta.retries", 9);

    unregisterExtensionConfiguration("blimy.zeta");
    registerExtensionConfiguration(
      createManifest("blimy.zeta", [{ key: "retries", type: "integer", default: 3 }]),
    );

    expect(getExtensionSetting("blimy.zeta.retries")).toBe(9);

    unregisterExtensionConfiguration("blimy.zeta");
  });

  it("restores persisted values on the next launch", () => {
    const persisted = new Map<string, string>();
    persisted.set("blimy.extension-settings.v1", JSON.stringify({ "blimy.eta.timeout": 42 }));
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => persisted.get(key) ?? null,
        setItem: (key: string, value: string) => persisted.set(key, value),
        removeItem: (key: string) => persisted.delete(key),
        clear: () => persisted.clear(),
      },
    });

    hydrateExtensionSettings();
    registerExtensionConfiguration(
      createManifest("blimy.eta", [{ key: "timeout", type: "integer", default: 10 }]),
    );

    expect(getExtensionSetting("blimy.eta.timeout")).toBe(42);

    unregisterExtensionConfiguration("blimy.eta");
  });

  it("notifies subscribers when a value changes", () => {
    registerExtensionConfiguration(
      createManifest("blimy.epsilon", [{ key: "flag", type: "boolean", default: false }]),
    );

    let notifications = 0;
    const unsubscribe = subscribeToExtensionSettings(() => {
      notifications++;
    });

    setExtensionSetting("blimy.epsilon.flag", true);
    resetExtensionSetting("blimy.epsilon.flag");
    unsubscribe();

    expect(notifications).toBe(2);

    unregisterExtensionConfiguration("blimy.epsilon");
  });
});
