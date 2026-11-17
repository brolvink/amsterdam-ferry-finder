import { describe, expect, it } from "vitest";
import {
  findUpcomingDepartures,
  formatAmsterdamTime,
  getAmsterdamNow,
  getAmsterdamOffsetMs,
  isInServiceWindow,
  synthesizeWeek,
  weekFromStoredTimetable,
  type WeekTable,
} from "@/data/timetable";

// All instants are absolute (Z), so results must not depend on the machine's TZ.
const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

function range(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

// Weekday-only route: 06:30-22:30 every 15 min, Mon-Fri, no weekend service.
const weekdayOnly: WeekTable = [0, 1, 2, 3, 4, 5, 6].map((day) => (day < 5 ? range(390, 1350, 15) : []));
// Night route: 05:00 until 01:00 the next morning, every 30 min, every day.
const night: WeekTable = Array.from({ length: 7 }, () => range(300, 1500, 30));

describe("Amsterdam clock", () => {
  it("reads Amsterdam wall time for an instant, winter and summer", () => {
    // 2026-11-18 23:30Z = Thursday 00:30 in Amsterdam (CET, +1)
    expect(getAmsterdamNow(at("2026-11-18T23:30:00Z"))).toMatchObject({
      hours: 0,
      minutes: 30,
      weekday: 4,
      dateKey: "2026-11-19",
    });
    // 2026-07-01 22:30Z = Thursday 00:30 in Amsterdam (CEST, +2)
    expect(getAmsterdamNow(at("2026-07-01T22:30:00Z"))).toMatchObject({ hours: 0, minutes: 30, dateKey: "2026-07-02" });
  });

  it("switches offset exactly at 01:00 UTC on DST days", () => {
    expect(getAmsterdamOffsetMs(at("2026-10-25T00:59:00Z"))).toBe(2 * 3600_000);
    expect(getAmsterdamOffsetMs(at("2026-10-25T01:00:00Z"))).toBe(3600_000);
    expect(getAmsterdamOffsetMs(at("2027-03-28T00:59:00Z"))).toBe(3600_000);
    expect(getAmsterdamOffsetMs(at("2027-03-28T01:00:00Z"))).toBe(2 * 3600_000);
  });

  it("formats HH:mm in Amsterdam time", () => {
    expect(formatAmsterdamTime(at("2026-11-18T11:15:00Z"))).toBe("12:15");
    expect(formatAmsterdamTime(at("2026-11-18T23:05:00Z"))).toBe("00:05");
  });
});

describe("findUpcomingDepartures", () => {
  it("mid-day: next departures from the current day", () => {
    // Wednesday 12:07 Amsterdam
    const result = findUpcomingDepartures(weekdayOnly, at("2026-11-18T11:07:00Z"), 3);
    expect(result.map((d) => iso(d.utcMs))).toEqual([
      "2026-11-18T11:15:00.000Z",
      "2026-11-18T11:30:00.000Z",
      "2026-11-18T11:45:00.000Z",
    ]);
  });

  it("includes a departure at exactly now, excludes one a second ago", () => {
    expect(iso(findUpcomingDepartures(weekdayOnly, at("2026-11-18T11:15:00Z"), 1)[0].utcMs)).toBe("2026-11-18T11:15:00.000Z");
    expect(iso(findUpcomingDepartures(weekdayOnly, at("2026-11-18T11:15:01Z"), 1)[0].utcMs)).toBe("2026-11-18T11:30:00.000Z");
  });

  it("just before the last sailing: last one, then the next service day", () => {
    // Wednesday 22:20 Amsterdam
    const result = findUpcomingDepartures(weekdayOnly, at("2026-11-18T21:20:00Z"), 2);
    expect(result.map((d) => iso(d.utcMs))).toEqual(["2026-11-18T21:30:00.000Z", "2026-11-19T05:30:00.000Z"]);
  });

  it("after the last sailing: rolls to the next day", () => {
    // Wednesday 23:00 Amsterdam -> Thursday 06:30
    const [next] = findUpcomingDepartures(weekdayOnly, at("2026-11-18T22:00:00Z"), 1);
    expect(iso(next.utcMs)).toBe("2026-11-19T05:30:00.000Z");
  });

  it("after midnight: uses the previous service day's late sailings first", () => {
    // Saturday 00:40 Amsterdam: Friday's service still has a 01:00 sailing.
    const result = findUpcomingDepartures(night, at("2026-11-20T23:40:00Z"), 2);
    expect(result.map((d) => iso(d.utcMs))).toEqual(["2026-11-21T00:00:00.000Z", "2026-11-21T04:00:00.000Z"]);
    expect(result[0].minute).toBe(1500);
  });

  it("weekday-only route on Saturday: next is Monday morning", () => {
    // Saturday 10:00 Amsterdam
    const [next] = findUpcomingDepartures(weekdayOnly, at("2026-11-21T09:00:00Z"), 1);
    expect(iso(next.utcMs)).toBe("2026-11-23T05:30:00.000Z");
  });

  it("returns nothing for a route without any service", () => {
    expect(findUpcomingDepartures(Array.from({ length: 7 }, () => []), at("2026-11-18T11:00:00Z"), 3)).toEqual([]);
  });

  it("DST fall back: a repeated 02:30 maps to the second (CET) occurrence", () => {
    const week: WeekTable = Array.from({ length: 7 }, () => [1590]); // 02:30 after midnight
    // Saturday 2026-10-24 23:00 Amsterdam (CEST)
    const [next] = findUpcomingDepartures(week, at("2026-10-24T21:00:00Z"), 1);
    expect(iso(next.utcMs)).toBe("2026-10-25T01:30:00.000Z");
    expect(formatAmsterdamTime(next.utcMs)).toBe("02:30");
  });

  it("DST spring forward: a nonexistent 02:30 maps to 03:30 CEST", () => {
    const week: WeekTable = Array.from({ length: 7 }, () => [1590]);
    // Saturday 2027-03-27 23:00 Amsterdam (CET)
    const [next] = findUpcomingDepartures(week, at("2027-03-27T22:00:00Z"), 1);
    expect(iso(next.utcMs)).toBe("2027-03-28T01:30:00.000Z");
    expect(formatAmsterdamTime(next.utcMs)).toBe("03:30");
  });
});

describe("isInServiceWindow", () => {
  it("is true during the day and false after the last sailing has arrived", () => {
    expect(isInServiceWindow([weekdayOnly], 6, at("2026-11-18T11:00:00Z"))).toBe(true); // Wed 12:00
    expect(isInServiceWindow([weekdayOnly], 6, at("2026-11-18T21:35:00Z"))).toBe(true); // 22:35, still sailing
    expect(isInServiceWindow([weekdayOnly], 6, at("2026-11-18T22:00:00Z"))).toBe(false); // 23:00
    expect(isInServiceWindow([weekdayOnly], 6, at("2026-11-18T02:00:00Z"))).toBe(false); // 03:00
  });

  it("is false all Saturday for a weekday-only route", () => {
    expect(isInServiceWindow([weekdayOnly], 6, at("2026-11-21T11:00:00Z"))).toBe(false);
  });

  it("covers the previous service day's after-midnight tail", () => {
    expect(isInServiceWindow([night], 10, at("2026-11-20T23:40:00Z"))).toBe(true); // Sat 00:40
    expect(isInServiceWindow([night], 10, at("2026-11-21T02:00:00Z"))).toBe(false); // Sat 03:00
  });

  it("treats a short gap between service days as continuous (24/7 routes)", () => {
    const allNight: WeekTable = Array.from({ length: 7 }, () => range(240, 1668, 12)); // 04:00 .. 03:48
    expect(isInServiceWindow([allNight], 5, at("2026-11-18T02:57:00Z"))).toBe(true); // Wed 03:57
  });
});

describe("synthesizeWeek (fallback when no timetable is stored)", () => {
  it("respects operating hours and Mon-Fri", () => {
    const week = synthesizeWeek("Every 15 min", "06:30 - 22:30 (Mon-Fri)");
    expect(week[0][0]).toBe(390);
    expect(week[0][week[0].length - 1]).toBe(1350);
    expect(week[5]).toEqual([]);
    expect(week[6]).toEqual([]);
  });

  it("handles spans past midnight and offsets", () => {
    const week = synthesizeWeek("Every 30 min", "07:00 - 02:00", 10);
    expect(week[5][0]).toBe(430);
    expect(week[5][week[5].length - 1]).toBe(1540);
  });

  it("is not weekday-only when weekend hours are listed", () => {
    const week = synthesizeWeek("Every 6 min", "Mon-Sat 06:26 - 23:56, Sun 09:02 - 23:56");
    expect(week[6].length).toBeGreaterThan(0);
  });
});

describe("weekFromStoredTimetable", () => {
  it("expands deduplicated patterns per weekday", () => {
    const week = weekFromStoredTimetable({ patterns: [[400, 300], [500]], docks: { a: [0, 0, 0, 0, 0, 1, -1] } }, "a");
    expect(week).toEqual([[300, 400], [300, 400], [300, 400], [300, 400], [300, 400], [500], []]);
    expect(weekFromStoredTimetable({ patterns: [], docks: {} }, "a")).toBeNull();
  });
});
