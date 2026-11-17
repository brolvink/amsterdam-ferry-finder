import { useEffect, useState } from "react";

/** Milliseconds until the next multiple of `intervalMs` on the epoch clock (always > 0). */
export function msUntilNextTick(nowMs: number, intervalMs: number): number {
  return intervalMs - (nowMs % intervalMs);
}

/**
 * Current time in ms, refreshed on aligned ticks (a 10 s interval always lands on the minute boundary,
 * so countdowns flip exactly when the minute does). Pauses while the tab is hidden and catches up when it returns.
 */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: number | undefined;

    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, msUntilNextTick(Date.now(), intervalMs) + 20);
    };
    const stop = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      stop();
      if (!document.hidden) {
        setNow(Date.now());
        schedule();
      }
    };

    if (!document.hidden) schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}
