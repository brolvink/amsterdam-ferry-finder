import { describe, expect, it } from "vitest";
import {
  describeNextSailing,
  describeSailingTime,
  formatCompactNext,
  formatCountdown,
  isBoardingNow,
} from "./countdown";

const at = (label: string, dayOffset: number, timestamp = Date.UTC(2026, 10, 18, 5, 26)) => ({ label, dayOffset, timestamp });

describe("formatCountdown", () => {
  it("reads naturally", () => {
    expect(formatCountdown(0)).toBe("now");
    expect(formatCountdown(1)).toBe("1 min");
    expect(formatCountdown(12)).toBe("12 min");
    expect(formatCountdown(60)).toBe("1 h");
    expect(formatCountdown(65)).toBe("1 h 05 min");
  });

  it("never goes negative", () => {
    expect(formatCountdown(-3)).toBe("now");
  });
});

describe("isBoardingNow", () => {
  it("is only true within a minute", () => {
    expect(isBoardingNow(0)).toBe(true);
    expect(isBoardingNow(1)).toBe(true);
    expect(isBoardingNow(2)).toBe(false);
  });
});

describe("describeSailingTime", () => {
  it("handles today, tomorrow and later days", () => {
    expect(describeSailingTime(at("06:26", 0))).toBe("06:26");
    expect(describeSailingTime(at("06:26", 1))).toBe("tomorrow 06:26");
    // 2026-11-18 is a Wednesday
    expect(describeSailingTime(at("06:26", 2))).toBe("Wed 06:26");
  });
});

describe("describeNextSailing", () => {
  it("uses the tucked-in tone for another day", () => {
    expect(describeNextSailing(at("06:26", 1))).toBe("The boats are tucked in. Next sailing tomorrow 06:26.");
  });

  it("uses the quiet tone for later today", () => {
    expect(describeNextSailing(at("09:02", 0))).toBe("Quiet at the dock. Next sailing 09:02.");
  });

  it("copes with nothing on the board", () => {
    expect(describeNextSailing(null)).toMatch(/No sailings/);
  });
});

describe("formatCompactNext", () => {
  it("shows a countdown within the hour and the clock time otherwise", () => {
    expect(formatCompactNext({ ...at("12:10", 0), minutesUntil: 4 })).toBe("4 min");
    expect(formatCompactNext({ ...at("15:10", 0), minutesUntil: 140 })).toBe("15:10");
    expect(formatCompactNext({ ...at("06:26", 1), minutesUntil: 500 })).toBe("tmrw 06:26");
  });
});
