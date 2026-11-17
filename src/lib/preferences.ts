// Tiny persisted preference store. Values are strings in localStorage; every
// storage access is wrapped in try/catch and falls back to memory, so the app
// works (for the current visit) when storage is unavailable.

export const PREFERENCE_KEYS = {
  sound: "ferry.sound",
  themeMode: "ferry.themeMode",
  favorite: "ferry.favorite",
  nearMe: "ferry.nearMe",
  installDismissed: "ferry.installDismissed",
} as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

/** Returns the stored value, or null when nothing is stored. */
export function getPreference(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // Storage unavailable: use the in-memory value below.
  }
  return memory.get(key) ?? null;
}

/** Stores a value (or clears it with null) and notifies subscribers. */
export function setPreference(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);

  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Keep the in-memory value only.
  }
  notify(key);
}

/** Calls listener whenever the key changes, here or in another tab. Returns an unsubscribe function. */
export function subscribePreference(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Sound defaults to on; only an explicit "off" turns it off. */
export function getSoundEnabled(): boolean {
  return getPreference(PREFERENCE_KEYS.sound) !== "off";
}

export function setSoundEnabled(enabled: boolean): void {
  setPreference(PREFERENCE_KEYS.sound, enabled ? "on" : "off");
}

export function subscribeSoundEnabled(listener: () => void): () => void {
  return subscribePreference(PREFERENCE_KEYS.sound, listener);
}
