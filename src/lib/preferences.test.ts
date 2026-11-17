import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPreference, getSoundEnabled, setPreference, setSoundEnabled, subscribeSoundEnabled } from "./preferences";

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("preferences", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { value: fakeStorage(), configurable: true });
    setPreference("ferry.sound", null);
  });

  it("defaults sound to on and persists off", () => {
    expect(getSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(getSoundEnabled()).toBe(false);
    expect(window.localStorage.getItem("ferry.sound")).toBe("off");
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSoundEnabled(listener);
    setSoundEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setSoundEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("works when storage throws", () => {
    const denied = () => {
      throw new Error("denied");
    };
    Object.defineProperty(window, "localStorage", {
      value: { getItem: denied, setItem: denied, removeItem: denied },
      configurable: true,
    });
    setPreference("x", "1");
    expect(getPreference("x")).toBe("1");
  });
});
