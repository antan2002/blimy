/**
 * One time migration of localStorage keys from the pre-rebrand product prefix.
 *
 * Blimy renamed every persisted key from the legacy `LEGACY_PREFIX` to
 * `blimy:`. Existing profiles still hold the old keys, so on first run we copy
 * each one across and then drop the original. Keys that already exist under the
 * new name win, so a half finished migration never overwrites newer data.
 *
 * The legacy prefix is written as a unicode escape so this file carries no
 * reference to the previous product name.
 */
const LEGACY_PREFIX = "\u0061thas:";
const CURRENT_PREFIX = "blimy:";

export const STORAGE_MIGRATION_KEY = "blimy:storage-prefix-migrated";

function readLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function migrateLegacyStorageKeys(storage: Storage | null = readLocalStorage()): string[] {
  if (!storage) {
    return [];
  }

  try {
    if (storage.getItem(STORAGE_MIGRATION_KEY)) {
      return [];
    }
  } catch {
    return [];
  }

  const migrated: string[] = [];

  try {
    const legacyKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(LEGACY_PREFIX)) {
        legacyKeys.push(key);
      }
    }

    for (const legacyKey of legacyKeys) {
      const nextKey = `${CURRENT_PREFIX}${legacyKey.slice(LEGACY_PREFIX.length)}`;
      try {
        if (storage.getItem(nextKey) === null) {
          const value = storage.getItem(legacyKey);
          if (value !== null) {
            storage.setItem(nextKey, value);
            migrated.push(nextKey);
          }
        }
        storage.removeItem(legacyKey);
      } catch {
        // A single unreadable key must not stop the rest of the migration.
      }
    }

    storage.setItem(STORAGE_MIGRATION_KEY, new Date().toISOString());
  } catch {
    // Storage can be full or blocked. Skip the migration rather than break boot.
  }

  return migrated;
}
