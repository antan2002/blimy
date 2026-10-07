import type { ExtensionManifest } from "@/extensions/types/extension-manifest";
import {
  getManifestConfigurationProperties,
  type RegisteredConfigurationProperty,
} from "@/extensions/types/extension-contributions";

/**
 * Settings contributed by installed extensions.
 *
 * blimy's own `Settings` type is closed, so extension settings are not merged
 * into it. They live here instead, keyed by a qualified `<extensionId>.<key>`
 * name, and are read back through the extension worker API. The manifest
 * `default` seeds the value once, so extensions never see `undefined` for a
 * setting they declared.
 */

const STORAGE_KEY = "blimy.extension-settings.v1";

const properties = new Map<string, RegisteredConfigurationProperty>();
const overrides = new Map<string, unknown>();

type Listener = () => void;
const listeners = new Set<Listener>();

function readStoredOverrides(): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeStoredOverrides(): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(overrides)));
  } catch {
    // Ignore quota and private-mode failures; defaults still apply.
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function registerExtensionConfiguration(manifest: ExtensionManifest): void {
  for (const property of getManifestConfigurationProperties(manifest)) {
    properties.set(property.qualifiedKey, property);

    if (!overrides.has(property.qualifiedKey) && property.default !== undefined) {
      overrides.set(property.qualifiedKey, property.default);
    }
  }

  writeStoredOverrides();
  notify();
}

/**
 * Stops serving a setting while the extension is disabled. Persisted values are
 * kept, so re-enabling the extension restores what the user had chosen.
 */
export function unregisterExtensionConfiguration(extensionId: string): void {
  let changed = false;

  for (const key of Array.from(properties.keys())) {
    if (key.startsWith(`${extensionId}.`)) {
      properties.delete(key);
      changed = true;
    }
  }

  if (changed) notify();
}

/**
 * Forgets a setting entirely, used when the extension is uninstalled. Stored
 * values are dropped so reinstalling the same id starts from declared defaults.
 */
export function forgetExtensionConfiguration(extensionId: string): void {
  unregisterExtensionConfiguration(extensionId);

  let changed = false;

  for (const key of Array.from(overrides.keys())) {
    if (key.startsWith(`${extensionId}.`)) {
      overrides.delete(key);
      changed = true;
    }
  }

  if (changed) {
    writeStoredOverrides();
    notify();
  }
}

export function getExtensionConfigurationSettings(): Map<string, RegisteredConfigurationProperty> {
  return new Map(properties);
}

export function getExtensionSetting<T = unknown>(
  qualifiedKey: string,
  fallback?: T,
): T | undefined {
  // A stored value only counts while its extension is registered, so a disabled
  // extension stops answering reads even though its value is still on disk.
  const property = properties.get(qualifiedKey);
  if (!property) return fallback;

  const override = overrides.get(qualifiedKey);
  if (override !== undefined) return override as T;

  if (property.default !== undefined) return property.default as T;

  return fallback;
}

export function setExtensionSetting(qualifiedKey: string, value: unknown): void {
  if (!properties.has(qualifiedKey)) return;

  overrides.set(qualifiedKey, value);
  writeStoredOverrides();
  notify();
}

export function resetExtensionSetting(qualifiedKey: string): void {
  if (!overrides.delete(qualifiedKey)) return;

  writeStoredOverrides();
  notify();
}

/** Loads persisted values before any extension registers, so overrides survive a restart. */
export function hydrateExtensionSettings(): void {
  for (const [key, value] of Object.entries(readStoredOverrides())) {
    overrides.set(key, value);
  }
}

export function subscribeToExtensionSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
