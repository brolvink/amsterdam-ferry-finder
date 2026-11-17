// Pure timetable logic in Europe/Amsterdam time. No dependency on the data file, so it can be
// tested with fixtures. src/data/ferries.ts binds it to the real schedule data.
//
// Model: a "week" is 7 sorted arrays (index 0 = Monday ... 6 = Sunday) of minutes since the
// service day's midnight, Amsterdam wall clock. Values >= 1440 are after-midnight sailings
// of that service day (e.g. 1450 on Friday = Saturday 00:10).
//
// DST rule: a departure's wall-clock time is converted to an instant on the calendar date it
// falls on. A wall time that does not exist (spring forward, 02:xx) maps one hour later
// (03:xx CEST); a wall time that occurs twice (fall back, 02:xx) maps to the second occurrence
// (CET). Labels are formatted from the resulting instant, so they always show a real clock time.

export const AMSTERDAM_TIME_ZONE = "Europe/Amsterdam";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Monday = 0 ... Sunday = 6. */
export type WeekTable = number[][];

// ---------------------------------------------------------------------------
// Amsterdam clock

const amsterdamPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: AMSTERDAM_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Amsterdam changes offset on whole UTC hours, so caching per UTC hour is exact.
const offsetCache = new Map<number, number>();

function computeOffsetMs(utcMs: number): number {
  const parts = amsterdamPartsFormatter.formatToParts(new Date(utcMs));
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const part of parts) {
    const value = Number(part.value);
    switch (part.type) {
      case "year": year = value; break;
      case "month": month = value; break;
      case "day": day = value; break;
      case "hour": hour = value === 24 ? 0 : value; break;
      case "minute": minute = value; break;
      case "second": second = value; break;
    }
  }
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Offset of Amsterdam wall time from UTC at this instant, in ms (+1h in winter, +2h in summer). */
export function getAmsterdamOffsetMs(utcMs: number): number {
  const key = Math.floor(utcMs / HOUR_MS);
  let offset = offsetCache.get(key);
  if (offset === undefined) {
    if (offsetCache.size > 5000) offsetCache.clear();
    offset = computeOffsetMs(key * HOUR_MS);
    offsetCache.set(key, offset);
  }
  return offset;
}

/** "Wall ms": Amsterdam wall-clock time expressed as if it were UTC. */
function toWallMs(utcMs: number): number {
  return utcMs + getAmsterdamOffsetMs(utcMs);
}

/** Inverse of toWallMs, with the DST rule described at the top of this file. */
export function wallMsToUtcMs(wallMs: number): number {
  const guess = wallMs - getAmsterdamOffsetMs(wallMs);
  return wallMs - getAmsterdamOffsetMs(guess);
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function wallDayToDateKey(wallDay: number): string {
  const date = new Date(wallDay * DAY_MS);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function mondayIndexOfWallDay(wallDay: number): number {
  // 1970-01-01 was a Thursday (Monday-based index 3).
  return (((wallDay + 3) % 7) + 7) % 7;
}

export interface AmsterdamNow {
  hours: number;
  minutes: number;
  /** 0 = Sunday ... 6 = Saturday, same convention as Date#getDay. */
  weekday: number;
  /** Amsterdam calendar date, YYYY-MM-DD. */
  dateKey: string;
  /** Minutes since Amsterdam midnight (wall clock). */
  minutesOfDay: number;
}

/** The current Amsterdam wall clock, independent of the visitor's timezone. */
export function getAmsterdamNow(now: Date | number = Date.now()): AmsterdamNow {
  const utcMs = typeof now === "number" ? now : now.getTime();
  const wallMs = toWallMs(utcMs);
  const wallDay = Math.floor(wallMs / DAY_MS);
  const minutesOfDay = Math.floor((wallMs - wallDay * DAY_MS) / MINUTE_MS);
  return {
    hours: Math.floor(minutesOfDay / 60),
    minutes: minutesOfDay % 60,
    weekday: (mondayIndexOfWallDay(wallDay) + 1) % 7,
    dateKey: wallDayToDateKey(wallDay),
    minutesOfDay,
  };
}

/** "HH:mm" in Amsterdam time for an instant. */
export function formatAmsterdamTime(utcMs: number): string {
  const wallMs = toWallMs(utcMs);
  const minutesOfDay = Math.floor((wallMs - Math.floor(wallMs / DAY_MS) * DAY_MS) / MINUTE_MS);
  return `${pad2(Math.floor(minutesOfDay / 60))}:${pad2(minutesOfDay % 60)}`;
}

// ---------------------------------------------------------------------------
// Week tables

export interface StoredTimetable {
  patterns: number[][];
  docks: Record<string, number[]>;
}

/** Expand the stored (deduplicated) timetable into a week table for one departure dock. */
export function weekFromStoredTimetable(timetable: StoredTimetable | undefined, dockId: string): WeekTable | null {
  const indexes = timetable?.docks?.[dockId];
  if (!Array.isArray(indexes) || indexes.length !== 7 || !Array.isArray(timetable?.patterns)) return null;
  const week = indexes.map((index) => {
    const pattern = index >= 0 ? timetable.patterns[index] : undefined;
    return Array.isArray(pattern)
      ? pattern.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b)
      : [];
  });
  return week.some((day) => day.length > 0) ? week : null;
}

export function parseFrequencyMinutes(frequency: unknown, fallback = 10): number {
  if (typeof frequency !== "string") return fallback;
  // Lower bound for ranges like "Every 15-30 min".
  const parsed = Number.parseInt(frequency.match(/\d+/)?.[0] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Estimated week table from summary fields, for routes without a stored timetable.
 * Honours the first "HH:mm - HH:mm" span (end before start = runs past midnight), "24/7",
 * and a "Mon-Fri" qualifier. Departures are clock multiples of the frequency plus `offsetMinutes`.
 */
export function synthesizeWeek(frequency: string, operatingHours: string, offsetMinutes = 0): WeekTable {
  const step = parseFrequencyMinutes(frequency);
  let start = 0;
  let end = 1440 - 1;
  const span = operatingHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (operatingHours.trim() !== "24/7" && span) {
    start = Number(span[1]) * 60 + Number(span[2]);
    end = Number(span[3]) * 60 + Number(span[4]);
    if (end <= start) end += 1440;
  }
  const weekdaysOnly = /mon\s*-\s*fri/i.test(operatingHours) && !/sat|sun/i.test(operatingHours);

  const day: number[] = [];
  const first = start + (((offsetMinutes - start) % step) + step) % step;
  for (let minute = first; minute <= end; minute += step) day.push(minute);
  return Array.from({ length: 7 }, (_, index) => (weekdaysOnly && index >= 5 ? [] : day));
}

function lowerBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function departureUtcMs(serviceWallDay: number, minute: number): number {
  return wallMsToUtcMs(serviceWallDay * DAY_MS + minute * MINUTE_MS);
}

export interface RawDeparture {
  utcMs: number;
  /** Wall-day index (days since 1970-01-01 in Amsterdam) of the service day it belongs to. */
  serviceDay: number;
  /** Minutes since that service day's midnight (may be >= 1440). */
  minute: number;
}

/**
 * The next `count` departures at or after `nowMs`, looking ahead at most `maxDays` service days.
 * Checks the previous service day too, for after-midnight sailings.
 */
export function findUpcomingDepartures(week: WeekTable, nowMs: number, count: number, maxDays = 8): RawDeparture[] {
  const wallNow = toWallMs(nowMs);
  const today = Math.floor(wallNow / DAY_MS);
  const nowMinute = (wallNow - today * DAY_MS) / MINUTE_MS;
  const results: RawDeparture[] = [];
  let stopAfter = Number.POSITIVE_INFINITY;

  for (let k = -1; k <= maxDays && k <= stopAfter; k++) {
    const serviceDay = today + k;
    const times = week[mondayIndexOfWallDay(serviceDay)];
    if (!times || times.length === 0) continue;
    // 60 min of slack for DST; the exact check is on the converted instant.
    let index = lowerBound(times, nowMinute - k * 1440 - 60);
    let fromThisDay = 0;
    for (; index < times.length && fromThisDay < count; index++) {
      const utcMs = departureUtcMs(serviceDay, times[index]);
      if (utcMs < nowMs) continue;
      results.push({ utcMs, serviceDay, minute: times[index] });
      fromThisDay++;
    }
    // A later service day can only interleave with this one through after-midnight sailings,
    // so one more day is enough once we have `count`.
    if (results.length >= count && k >= 0 && stopAfter === Number.POSITIVE_INFINITY) stopAfter = k + 1;
  }

  results.sort((a, b) => a.utcMs - b.utcMs);
  if (results.length > count) results.length = count;
  return results;
}

/**
 * Calls `visit` for every departure whose instant lies in [fromMs, toMs]. Windows are expected
 * to be short (hours). Allocation-free apart from what `visit` does.
 */
export function forEachDepartureBetween(
  week: WeekTable,
  fromMs: number,
  toMs: number,
  visit: (utcMs: number, serviceDay: number, minute: number) => void
): void {
  const wallFrom = toWallMs(fromMs);
  const wallTo = toWallMs(toMs);
  const firstDay = Math.floor(wallFrom / DAY_MS) - 1;
  const lastDay = Math.floor(wallTo / DAY_MS);
  for (let serviceDay = firstDay; serviceDay <= lastDay; serviceDay++) {
    const times = week[mondayIndexOfWallDay(serviceDay)];
    if (!times || times.length === 0) continue;
    const base = serviceDay * DAY_MS;
    const lowMinute = (wallFrom - base) / MINUTE_MS - 60;
    const highMinute = (wallTo - base) / MINUTE_MS + 60;
    for (let index = lowerBound(times, lowMinute); index < times.length && times[index] <= highMinute; index++) {
      const utcMs = departureUtcMs(serviceDay, times[index]);
      if (utcMs >= fromMs && utcMs <= toMs) visit(utcMs, serviceDay, times[index]);
    }
  }
}

/** Service window of one service day across several docks: first departure to last departure + duration. */
function serviceWindow(weeks: WeekTable[], serviceDay: number, durationMinutes: number): [number, number] | null {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  const weekday = mondayIndexOfWallDay(serviceDay);
  for (const week of weeks) {
    const times = week[weekday];
    if (!times || times.length === 0) continue;
    first = Math.min(first, times[0]);
    last = Math.max(last, times[times.length - 1]);
  }
  if (!Number.isFinite(first)) return null;
  return [departureUtcMs(serviceDay, first), departureUtcMs(serviceDay, last) + durationMinutes * MINUTE_MS];
}

/** Gaps between consecutive service days shorter than this count as continuous service. */
const CONTINUOUS_SERVICE_GAP_MS = 30 * MINUTE_MS;

/**
 * Whether the route is in its timetabled service period at `nowMs`: between the first
 * departure of a service day and the last departure plus sailing time (including the previous
 * day's after-midnight tail). Night gaps inside a service day (e.g. 30-60 min headways) still
 * count as in service.
 */
export function isInServiceWindow(weeks: WeekTable[], durationMinutes: number, nowMs: number): boolean {
  const today = Math.floor(toWallMs(nowMs) / DAY_MS);
  const windows: [number, number][] = [];
  for (let serviceDay = today - 1; serviceDay <= today + 1; serviceDay++) {
    const window = serviceWindow(weeks, serviceDay, durationMinutes);
    if (window) windows.push(window);
  }
  for (let i = 0; i < windows.length; i++) {
    const [start, end] = windows[i];
    if (nowMs >= start && nowMs <= end) return true;
    const next = windows[i + 1];
    if (next && nowMs > end && nowMs < next[0] && next[0] - end <= CONTINUOUS_SERVICE_GAP_MS) return true;
  }
  return false;
}

/** Calendar-day difference (Amsterdam) between two instants. */
export function amsterdamDayOffset(fromMs: number, toMs: number): number {
  return Math.floor(toWallMs(toMs) / DAY_MS) - Math.floor(toWallMs(fromMs) / DAY_MS);
}

export function amsterdamDateKey(utcMs: number): string {
  return wallDayToDateKey(Math.floor(toWallMs(utcMs) / DAY_MS));
}
