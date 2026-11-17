import { describe, expect, it } from "vitest";
import {
  BOARDING_BUFFER_MINUTES,
  FAR_AWAY_METERS,
  estimateTravelMinutes,
  findNearestStation,
  formatDistance,
  getCatchVerdict,
  haversineMeters,
} from "./geo";

const centraal = { lat: 52.3791, lng: 4.9003 };
const ndsm = { lat: 52.4013, lng: 4.8909 };

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    expect(haversineMeters(centraal, centraal)).toBe(0);
  });

  it("matches a known distance (Centraal to NDSM is about 2.6 km)", () => {
    const d = haversineMeters(centraal, ndsm);
    expect(d).toBeGreaterThan(2500);
    expect(d).toBeLessThan(2700);
  });

  it("is symmetric", () => {
    expect(haversineMeters(centraal, ndsm)).toBeCloseTo(haversineMeters(ndsm, centraal), 6);
  });

  it("one degree of latitude is about 111 km", () => {
    expect(haversineMeters({ lat: 52, lng: 5 }, { lat: 53, lng: 5 })).toBeGreaterThan(111_000);
    expect(haversineMeters({ lat: 52, lng: 5 }, { lat: 53, lng: 5 })).toBeLessThan(111_400);
  });
});

describe("estimateTravelMinutes", () => {
  it("applies the detour factor, pace and boarding buffer (500 m walk)", () => {
    // 500 * 1.3 / 80 = 8.125 -> 9, plus the buffer
    expect(estimateTravelMinutes(500, "walk")).toBe(9 + BOARDING_BUFFER_MINUTES);
  });

  it("cycling is faster than walking (500 m)", () => {
    // 500 * 1.3 / 250 = 2.6 -> 3, plus the buffer
    expect(estimateTravelMinutes(500, "bike")).toBe(3 + BOARDING_BUFFER_MINUTES);
  });

  it("standing at the dock still needs the buffer", () => {
    expect(estimateTravelMinutes(0, "walk")).toBe(BOARDING_BUFFER_MINUTES);
  });

  it("ignores nonsense distances", () => {
    expect(estimateTravelMinutes(Number.NaN, "bike")).toBe(BOARDING_BUFFER_MINUTES);
    expect(estimateTravelMinutes(-50, "walk")).toBe(BOARDING_BUFFER_MINUTES);
  });
});

describe("findNearestStation", () => {
  const stations = [
    { id: "cs", ...centraal },
    { id: "ndsm", ...ndsm },
  ];

  it("picks the closest station", () => {
    const result = findNearestStation({ lat: 52.3995, lng: 4.8925 }, stations);
    expect(result?.station.id).toBe("ndsm");
    expect(result?.farAway).toBe(false);
    expect(result?.walkMinutes).toBeGreaterThan(result?.bikeMinutes ?? 0);
  });

  it("flags visitors far from every station", () => {
    // Rotterdam
    const result = findNearestStation({ lat: 51.9244, lng: 4.4777 }, stations);
    expect(result?.distanceMeters).toBeGreaterThan(FAR_AWAY_METERS);
    expect(result?.farAway).toBe(true);
  });

  it("returns null without stations", () => {
    expect(findNearestStation(centraal, [])).toBeNull();
  });
});

describe("getCatchVerdict", () => {
  const minute = 60_000;

  it("is comfortable with 3 or more spare minutes", () => {
    expect(getCatchVerdict(13 * minute, 10)).toBe("comfortable");
  });

  it("is a hurry with less than 3 spare minutes", () => {
    expect(getCatchVerdict(12.9 * minute, 10)).toBe("hurry");
    expect(getCatchVerdict(10 * minute, 10)).toBe("hurry");
  });

  it("is too late when the walk takes longer than the wait", () => {
    expect(getCatchVerdict(9.9 * minute, 10)).toBe("too-late");
    expect(getCatchVerdict(0, 2)).toBe("too-late");
  });
});

describe("formatDistance", () => {
  it("formats metres and kilometres", () => {
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(4)).toBe("10 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(12_400)).toBe("12 km");
  });
});
