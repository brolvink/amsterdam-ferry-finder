import { AMSTERDAM_TIME_ZONE, type FerryDeparture } from "@/data/ferries";

/** "now", "1 min", "12 min", "1 h 05 min". Input is whole minutes until departure. */
export function formatCountdown(minutesUntil: number): string {
  const minutes = Math.max(0, Math.round(minutesUntil));
  if (minutes === 0) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")} min`;
}

/** Departures this close read as "Boarding now" on the route card. */
export const BOARDING_NOW_MAX_MINUTES = 1;

export function isBoardingNow(minutesUntil: number): boolean {
  return minutesUntil <= BOARDING_NOW_MAX_MINUTES;
}

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: AMSTERDAM_TIME_ZONE });

type DepartureTiming = Pick<FerryDeparture, "label" | "dayOffset" | "timestamp">;

/** "06:26", "tomorrow 06:26" or "Wed 06:26", depending on how far away the sailing is. */
export function describeSailingTime(departure: DepartureTiming): string {
  if (departure.dayOffset <= 0) return departure.label;
  if (departure.dayOffset === 1) return `tomorrow ${departure.label}`;
  return `${weekdayFormatter.format(departure.timestamp)} ${departure.label}`;
}

/** Warm copy for a route or direction with nothing on the board soon. */
export function describeNextSailing(departure: DepartureTiming | null): string {
  if (!departure) return "No sailings on the board this week.";
  const when = describeSailingTime(departure);
  return departure.dayOffset >= 1
    ? `The boats are tucked in. Next sailing ${when}.`
    : `Quiet at the dock. Next sailing ${when}.`;
}

/** Narrow label for the HUD slots: "now", "7 min" within the hour, else the clock time. */
export function formatCompactNext(departure: DepartureTiming & Pick<FerryDeparture, "minutesUntil">): string {
  if (departure.dayOffset === 0 && departure.minutesUntil < 60) return formatCountdown(departure.minutesUntil);
  if (departure.dayOffset === 1) return `tmrw ${departure.label}`;
  return departure.dayOffset > 1 ? describeSailingTime(departure) : departure.label;
}
