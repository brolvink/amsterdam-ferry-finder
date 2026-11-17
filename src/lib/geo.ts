// Distance and "can I make it?" maths. Pure and free of browser APIs, so it is easy to test.
// Everything here runs on the device; positions are never stored or sent anywhere.

export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = "walk" | "bike";

const EARTH_RADIUS_M = 6_371_000;

/** Average adult walking pace (about 4.8 km/h). */
export const WALK_METERS_PER_MINUTE = 80;
/** Relaxed city cycling (about 15 km/h), including slowing for crossings. */
export const BIKE_METERS_PER_MINUTE = 250;
/** Streets are not straight lines: real routes are roughly 30% longer than the crow-flies distance. */
export const DETOUR_FACTOR = 1.3;
/** Extra minute for finding the gate and stepping aboard (bikes roll on, so the same for both). */
export const BOARDING_BUFFER_MINUTES = 1;
/** Beyond this the visitor is not near the ferries; we say so instead of showing verdicts. */
export const FAR_AWAY_METERS = 15_000;
/** Spare minutes needed to call a connection comfortable instead of a rush. */
export const COMFORTABLE_SLACK_MINUTES = 3;

export type CatchVerdict = "comfortable" | "hurry" | "too-late";

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Whole minutes to reach the dock (rounded up, boarding buffer included). */
export function estimateTravelMinutes(distanceMeters: number, mode: TravelMode): number {
  const speed = mode === "walk" ? WALK_METERS_PER_MINUTE : BIKE_METERS_PER_MINUTE;
  const safeDistance = Math.max(0, Number.isFinite(distanceMeters) ? distanceMeters : 0);
  return Math.ceil((safeDistance * DETOUR_FACTOR) / speed) + BOARDING_BUFFER_MINUTES;
}

export interface NearestStation<T extends LatLng> {
  station: T;
  distanceMeters: number;
  walkMinutes: number;
  bikeMinutes: number;
  /** True when the visitor is farther than FAR_AWAY_METERS from every station. */
  farAway: boolean;
}

export function findNearestStation<T extends LatLng>(from: LatLng, stations: readonly T[]): NearestStation<T> | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const station of stations) {
    const distance = haversineMeters(from, station);
    if (distance < bestDistance) {
      best = station;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  return {
    station: best,
    distanceMeters: bestDistance,
    walkMinutes: estimateTravelMinutes(bestDistance, "walk"),
    bikeMinutes: estimateTravelMinutes(bestDistance, "bike"),
    farAway: bestDistance > FAR_AWAY_METERS,
  };
}

/**
 * Can the visitor catch a departure? Slack is the time left after getting there:
 * at least COMFORTABLE_SLACK_MINUTES is comfortable, 0 or more is a rush, below 0 is missed.
 */
export function getCatchVerdict(msUntilDeparture: number, travelMinutes: number): CatchVerdict {
  const slackMinutes = msUntilDeparture / 60_000 - travelMinutes;
  if (slackMinutes >= COMFORTABLE_SLACK_MINUTES) return "comfortable";
  if (slackMinutes >= 0) return "hurry";
  return "too-late";
}

/** "350 m" below a kilometre, "1.2 km" above. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}
