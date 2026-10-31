/**
 * One-time storage migration helper from legacy "etude.*" and "wikaa.*" keys to "wikae.*".
 * Ensures existing user preferences, themes, language, and panel states migrate smoothly without data loss.
 */
export function migrateStorage() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const toMigrate: { oldKey: string; newKey: string; val: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("etude.") || key.startsWith("wikaa."))) {
        const suffix = key.startsWith("etude.") ? key.slice(6) : key.slice(6);
        const newKey = "wikae." + suffix;
        const val = localStorage.getItem(key);
        if (val !== null && localStorage.getItem(newKey) === null) {
          toMigrate.push({ oldKey: key, newKey, val });
        }
      }
    }
    for (const item of toMigrate) {
      localStorage.setItem(item.newKey, item.val);
    }
  } catch {
    // Storage access may be restricted in sandboxed environments
  }
}

/**
 * Reads a storage item with automatic backward-compatible fallback from etude.* and wikaa.* to wikae.*
 */
export function getStorageItem(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
    if (key.startsWith("wikae.")) {
      const suffix = key.slice(6);
      return localStorage.getItem("wikaa." + suffix) ?? localStorage.getItem("etude." + suffix);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sets a storage item under the wikae.* namespace and keeps legacy keys synced
 */
export function setStorageItem(key: string, value: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(key, value);
    if (key.startsWith("wikae.")) {
      const suffix = key.slice(6);
      localStorage.setItem("wikaa." + suffix, value);
      localStorage.setItem("etude." + suffix, value);
    }
  } catch {
    // Storage access may be restricted
  }
}
