import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { msUntilNextTick, useNow } from "./useNow";

describe("msUntilNextTick", () => {
  it("aligns to the interval", () => {
    expect(msUntilNextTick(12_345, 10_000)).toBe(7_655);
    expect(msUntilNextTick(20_000, 10_000)).toBe(10_000);
  });
});

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T10:00:03Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks without user interaction, on the interval boundary", () => {
    const { result } = renderHook(() => useNow(10_000));
    const first = result.current;
    act(() => {
      vi.advanceTimersByTime(7_100);
    });
    expect(result.current).toBeGreaterThan(first);
    expect(result.current % 10_000).toBeLessThan(200);
  });

  it("stops ticking while the tab is hidden", () => {
    const { result } = renderHook(() => useNow(10_000));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const frozen = result.current;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(frozen);

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBeGreaterThan(frozen);
  });
});
