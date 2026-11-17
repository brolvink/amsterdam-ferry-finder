import { useCallback, useSyncExternalStore } from "react";
import {
  PREFERENCE_KEYS,
  getPreference,
  getSoundEnabled,
  setPreference,
  subscribePreference,
  subscribeSoundEnabled,
} from "@/lib/preferences";

/** Reactive view of a raw string preference: [value, setValue]. */
export function usePreference(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    useCallback((listener: () => void) => subscribePreference(key, listener), [key]),
    () => getPreference(key),
    () => null,
  );
  const setValue = useCallback((next: string | null) => setPreference(key, next), [key]);
  return [value, setValue];
}

/** Reactive shared sound on/off flag (defaults to true). */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribeSoundEnabled, getSoundEnabled, () => true);
}

export { PREFERENCE_KEYS };
