import ferryScheduleData, {
  type FerryRouteStatus,
  type FerryScheduleEntry,
  type FerryScheduleMeta,
} from "@/data/ferryScheduleData";
import {
  amsterdamDateKey,
  amsterdamDayOffset,
  findUpcomingDepartures,
  forEachDepartureBetween,
  formatAmsterdamTime,
  isInServiceWindow,
  synthesizeWeek,
  parseFrequencyMinutes,
  weekFromStoredTimetable,
  type WeekTable,
} from "@/data/timetable";

export { getAmsterdamNow, formatAmsterdamTime, AMSTERDAM_TIME_ZONE, type AmsterdamNow } from "@/data/timetable";
export type { FerryRouteStatus, FerryScheduleMeta } from "@/data/ferryScheduleData";

export interface FerryDock {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Docks a few metres apart share a station (one card, one marker). */
  stationId: string;
}

export interface FerryStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  dockIds: string[];
}

interface GeoPoint {
  lat: number;
  lng: number;
}

export interface FerryRoute {
  id: string;
  name: string;
  code: string;
  docks: [FerryDock, FerryDock];
  path: GeoPoint[];
  color: string;
  frequency: string;
  duration: number; // one-way sailing duration in minutes
  operatingHours: string;
  /** Static operator status from the data file; use getRouteServiceStatus for "running right now". */
  status: FerryRouteStatus;
  /** "timetable" = real GVB departures; "estimated" = generated from frequency and operating hours. */
  scheduleSource: "timetable" | "estimated";
}

export interface FerryPosition {
  id: string;
  routeId: string;
  lat: number;
  lng: number;
  heading: number; // degrees
  progress: number; // 0-1 for active leg
  direction: "outbound" | "inbound";
  speed: number; // knots
  eta: number; // minutes to destination while sailing
  isDocked: boolean;
  dockId: string | null;
}

export interface FerryDeparture {
  routeId: string;
  /** Dock the ferry departs from. */
  dockId: string;
  /** Dock the ferry sails to. */
  destinationDockId: string;
  time: Date;
  timestamp: number;
  /** "HH:mm", Amsterdam time. */
  label: string;
  /** Whole minutes until departure (rounded up; 0 = departing this minute). */
  minutesUntil: number;
  /** Amsterdam calendar date of the departure, YYYY-MM-DD. */
  dateKey: string;
  /** Amsterdam calendar days after `now` (0 = today, 1 = tomorrow, ...). */
  dayOffset: number;
}

export interface DockDeparturesOptions {
  now?: Date | number;
  /** Max departures in `departures` (default 5, max 20). */
  count?: number;
  /** Only departures within this many minutes go in `departures` (default 180). */
  horizonMinutes?: number;
}

export interface DockDeparturesResult {
  routeId: string;
  dockId: string;
  destinationDockId: string;
  /** Upcoming departures within the horizon, soonest first. Empty when nothing is soon. */
  departures: FerryDeparture[];
  /** The first upcoming departure even if beyond the horizon (null if none within 8 days). */
  next: FerryDeparture | null;
  /** True when at least one more departure leaves today (Amsterdam calendar date). */
  hasMoreToday: boolean;
  scheduleSource: FerryRoute["scheduleSource"];
}

export interface RouteServiceStatus {
  routeId: string;
  /** True between the first and last timetabled sailing (+ sailing time) of a service day. */
  inService: boolean;
  /** "offline" if the data file says so; else the stored status when in service, "out-of-service" outside the timetable. */
  status: FerryRouteStatus | "out-of-service";
  /** Next departure from either dock. */
  next: FerryDeparture | null;
}

const DEFAULT_DURATION_MINUTES = 6;
const DOCKED_BEFORE_DEPARTURE_MINUTES = 2;
const MINUTE_MS = 60_000;
const FALLBACK_SCHEDULE_META: FerryScheduleMeta = {
  source: "GVB official timetable (auto-synced)",
  lastUpdated: new Date(0).toISOString(),
  lastChecked: new Date(0).toISOString(),
  refreshCadence: "weekly",
};

const routeWaypoints: Record<string, [number, number][]> = {
  f1: [
    [52.381048, 4.900236],
    [52.381485, 4.901799],
  ],
  f2: [
    [52.379618, 4.906621],
    [52.380535, 4.907229],
  ],
  f3: [
    [52.385589, 4.897345],
    [52.391862, 4.894263],
    [52.397228, 4.891946],
  ],
  f4: [
    [52.393768, 4.889005],
    [52.394661, 4.892091],
  ],
  f5: [
    [52.379134, 4.934192],
    [52.382792, 4.932524],
  ],
  f6: [
    [52.396251, 4.887998],
    [52.399102, 4.889176],
  ],
};

export const ferryDocks: FerryDock[] = [
  { id: "cs-ndsm", name: "Centraal Station", lat: 52.38084352843545, lng: 4.89917802825759, stationId: "cs" },
  { id: "cs-buik", name: "Centraal Station", lat: 52.3807188117236, lng: 4.899427901507475, stationId: "cs" },
  { id: "cs-east", name: "Centraal Station (East)", lat: 52.3784191027723, lng: 4.9055495479905, stationId: "cs-east" },
  { id: "buik", name: "Buiksloterweg", lat: 52.382235464529835, lng: 4.903109850398619, stationId: "buik" },
  { id: "ndsm", name: "NDSM", lat: 52.4013290166148, lng: 4.890924271312947, stationId: "ndsm" },
  { id: "pontsteiger", name: "Pontsteiger", lat: 52.39267111816572, lng: 4.886411014175174, stationId: "pontsteiger" },
  { id: "distel", name: "Distelweg", lat: 52.39578749178729, lng: 4.89649611976632, stationId: "distel" },
  { id: "ijplein", name: "IJplein", lat: 52.38171899630089, lng: 4.908356748760325, stationId: "ijplein" },
  { id: "zamenhof", name: "Zamenhofstraat", lat: 52.38481138360226, lng: 4.930879460839123, stationId: "zamenhof" },
  { id: "azartplein", name: "Azartplein", lat: 52.37770533239611, lng: 4.937446977362498, stationId: "azartplein" },
];

/** One entry per physical station; Centraal Station's two IJ docks (about 20 m apart) are merged. */
export const ferryStations: FerryStation[] = (() => {
  const stations = new Map<string, FerryStation>();
  for (const dock of ferryDocks) {
    const station = stations.get(dock.stationId);
    if (station) {
      station.dockIds.push(dock.id);
      const n = station.dockIds.length;
      station.lat = (station.lat * (n - 1) + dock.lat) / n;
      station.lng = (station.lng * (n - 1) + dock.lng) / n;
    } else {
      stations.set(dock.stationId, { id: dock.stationId, name: dock.name, lat: dock.lat, lng: dock.lng, dockIds: [dock.id] });
    }
  }
  return [...stations.values()];
})();

export function getStationForDock(dockId: string): FerryStation | undefined {
  const dock = ferryDocks.find((candidate) => candidate.id === dockId);
  return dock ? ferryStations.find((station) => station.id === dock.stationId) : undefined;
}

/** All docks at the same station as `dockId`, including itself (empty for an unknown id). */
export function getDocksAtSameStation(dockId: string): FerryDock[] {
  const dock = ferryDocks.find((candidate) => candidate.id === dockId);
  return dock ? ferryDocks.filter((candidate) => candidate.stationId === dock.stationId) : [];
}

interface BaseRouteDef {
  id: string;
  name: string;
  code: string;
  dockIds: [string, string];
  color: string;
  defaults: Pick<FerryScheduleEntry, "frequency" | "duration" | "operatingHours" | "status">;
}

const baseRoutes: BaseRouteDef[] = [
  {
    id: "f1",
    name: "Buiksloterweg",
    code: "F3",
    dockIds: ["cs-buik", "buik"],
    color: "#2196F3",
    defaults: { frequency: "Every 5 min", duration: 4, operatingHours: "24/7", status: "active" },
  },
  {
    id: "f2",
    name: "IJplein",
    code: "F2",
    dockIds: ["cs-east", "ijplein"],
    color: "#FF9800",
    defaults: { frequency: "Every 8 min", duration: 5, operatingHours: "06:30 - 00:00", status: "active" },
  },
  {
    id: "f3",
    name: "NDSM",
    code: "F4",
    dockIds: ["cs-ndsm", "ndsm"],
    color: "#E91E63",
    defaults: { frequency: "Every 10 min", duration: 14, operatingHours: "07:00 - 02:00", status: "active" },
  },
  {
    id: "f4",
    name: "Distelweg",
    code: "F6",
    dockIds: ["pontsteiger", "distel"],
    color: "#4CAF50",
    defaults: { frequency: "Every 15 min", duration: 6, operatingHours: "06:30 - 22:30 (Mon-Fri)", status: "active" },
  },
  {
    id: "f5",
    name: "Zamenhofstraat / Azartplein",
    code: "F1",
    dockIds: ["azartplein", "zamenhof"],
    color: "#9C27B0",
    defaults: { frequency: "Every 20 min", duration: 6, operatingHours: "06:30 - 22:30", status: "active" },
  },
  {
    id: "f6",
    name: "NDSM",
    code: "F7",
    dockIds: ["pontsteiger", "ndsm"],
    color: "#03A9F4",
    defaults: { frequency: "Every 20 min", duration: 9, operatingHours: "06:30 - 22:30", status: "active" },
  },
];

const scheduleEntries: FerryScheduleEntry[] = Array.isArray(ferryScheduleData?.routes) ? ferryScheduleData.routes : [];
const routeScheduleById = new Map<string, FerryScheduleEntry>(scheduleEntries.map((r) => [r.id, r]));

function sanitizeRouteStatus(status: unknown, fallback: FerryRouteStatus): FerryRouteStatus {
  return status === "active" || status === "delayed" || status === "offline" ? status : fallback;
}

function sanitizeScheduleEntry(
  routeId: string,
  schedule: Partial<FerryScheduleEntry> | undefined,
  defaults: BaseRouteDef["defaults"]
): Omit<FerryScheduleEntry, "timetable"> {
  const frequencyText = typeof schedule?.frequency === "string" ? schedule.frequency.trim() : "";
  const operatingHoursText = typeof schedule?.operatingHours === "string" ? schedule.operatingHours.trim() : "";
  const duration = Number(schedule?.duration);

  return {
    id: routeId,
    frequency: frequencyText.length > 0 ? frequencyText : defaults.frequency,
    duration: Number.isFinite(duration) && duration > 0 ? duration : defaults.duration,
    operatingHours: operatingHoursText.length > 0 ? operatingHoursText : defaults.operatingHours,
    status: sanitizeRouteStatus(schedule?.status, defaults.status),
  };
}

function buildRoutePath(routeId: string, dockA: FerryDock, dockB: FerryDock): GeoPoint[] {
  const waypoints = routeWaypoints[routeId] ?? [];
  return [
    { lat: dockA.lat, lng: dockA.lng },
    ...waypoints.map(([lat, lng]) => ({ lat, lng })),
    { lat: dockB.lat, lng: dockB.lng },
  ];
}

/** Old estimate for the second dock: half a round-trip cycle after the first dock. */
function estimatedSecondDockOffset(frequency: string, duration: number): number {
  const step = parseFrequencyMinutes(frequency);
  const ferryCount = Math.ceil((2 * (duration + 1)) / step);
  return Math.round((ferryCount * step) / 2);
}

interface RouteRuntime {
  route: FerryRoute;
  /** Week tables indexed like route.docks. */
  weeks: [WeekTable, WeekTable];
}

const routeRuntimes: RouteRuntime[] = baseRoutes.map((baseRoute) => {
  const [dockA, dockB] = baseRoute.dockIds.map(
    (dockId) => ferryDocks.find((dock) => dock.id === dockId) as FerryDock
  ) as [FerryDock, FerryDock];
  const stored = routeScheduleById.get(baseRoute.id);
  const schedule = sanitizeScheduleEntry(baseRoute.id, stored, baseRoute.defaults);

  const storedA = weekFromStoredTimetable(stored?.timetable, dockA.id);
  const storedB = weekFromStoredTimetable(stored?.timetable, dockB.id);
  const hasTimetable = storedA !== null && storedB !== null;
  const weeks: [WeekTable, WeekTable] = hasTimetable
    ? [storedA, storedB]
    : [
        synthesizeWeek(schedule.frequency, schedule.operatingHours, 0),
        synthesizeWeek(
          schedule.frequency,
          schedule.operatingHours,
          estimatedSecondDockOffset(schedule.frequency, schedule.duration)
        ),
      ];

  return {
    route: {
      id: baseRoute.id,
      name: baseRoute.name,
      code: baseRoute.code,
      docks: [dockA, dockB],
      path: buildRoutePath(baseRoute.id, dockA, dockB),
      color: baseRoute.color,
      frequency: schedule.frequency,
      duration: schedule.duration,
      operatingHours: schedule.operatingHours,
      status: schedule.status,
      scheduleSource: hasTimetable ? "timetable" : "estimated",
    },
    weeks,
  };
});

export const ferryRoutes: FerryRoute[] = routeRuntimes.map((runtime) => runtime.route);

const runtimeById = new Map<string, RouteRuntime>(routeRuntimes.map((runtime) => [runtime.route.id, runtime]));

function toMs(now: Date | number | undefined): number {
  if (now === undefined) return Date.now();
  return typeof now === "number" ? now : now.getTime();
}

function makeDeparture(runtime: RouteRuntime, side: 0 | 1, utcMs: number, nowMs: number): FerryDeparture {
  return {
    routeId: runtime.route.id,
    dockId: runtime.route.docks[side].id,
    destinationDockId: runtime.route.docks[side === 0 ? 1 : 0].id,
    time: new Date(utcMs),
    timestamp: utcMs,
    label: formatAmsterdamTime(utcMs),
    minutesUntil: Math.max(0, Math.ceil((utcMs - nowMs) / MINUTE_MS)),
    dateKey: amsterdamDateKey(utcMs),
    dayOffset: amsterdamDayOffset(nowMs, utcMs),
  };
}

// ---------------------------------------------------------------------------
// Schedule meta

export function getScheduleMeta(): FerryScheduleMeta {
  const incomingMeta = ferryScheduleData?.meta;
  const source = typeof incomingMeta?.source === "string" && incomingMeta.source.trim().length > 0
    ? incomingMeta.source.trim()
    : FALLBACK_SCHEDULE_META.source;
  const parsedLastUpdated = Date.parse(typeof incomingMeta?.lastUpdated === "string" ? incomingMeta.lastUpdated : "");
  const parsedLastChecked = Date.parse(typeof incomingMeta?.lastChecked === "string" ? incomingMeta.lastChecked : "");
  const refreshCadence = incomingMeta?.refreshCadence === "daily" || incomingMeta?.refreshCadence === "weekly"
    ? incomingMeta.refreshCadence
    : FALLBACK_SCHEDULE_META.refreshCadence;
  const lastUpdated = Number.isFinite(parsedLastUpdated)
    ? new Date(parsedLastUpdated).toISOString()
    : FALLBACK_SCHEDULE_META.lastUpdated;

  return {
    source,
    lastUpdated,
    // Older files have no lastChecked; the content date is the best lower bound.
    lastChecked: Number.isFinite(parsedLastChecked) ? new Date(parsedLastChecked).toISOString() : lastUpdated,
    refreshCadence,
    ...(incomingMeta?.window ? { window: incomingMeta.window } : {}),
  };
}

// ---------------------------------------------------------------------------
// Departures

/**
 * Upcoming departures from one dock of a route. Works for either dock, rolls past midnight
 * and into the next service day. When nothing departs within the horizon, `departures` is
 * empty and `next` / `hasMoreToday` say "next sailing at HH:mm" vs "no more service today".
 * Returns null for an unknown route or a dock that the route does not serve.
 */
export function getDockDepartures(
  routeId: string,
  dockId: string,
  options: DockDeparturesOptions = {}
): DockDeparturesResult | null {
  const runtime = runtimeById.get(routeId);
  if (!runtime) return null;
  const side = runtime.route.docks[0].id === dockId ? 0 : runtime.route.docks[1].id === dockId ? 1 : -1;
  if (side === -1) return null;

  const nowMs = toMs(options.now);
  const count = Number.isFinite(options.count) && options.count > 0 ? Math.min(Math.floor(options.count), 20) : 5;
  const horizonMinutes = Number.isFinite(options.horizonMinutes) && options.horizonMinutes >= 0 ? options.horizonMinutes : 180;
  const horizonMs = nowMs + horizonMinutes * MINUTE_MS;

  const raw = findUpcomingDepartures(runtime.weeks[side], nowMs, count);
  const all = raw.map((departure) => makeDeparture(runtime, side, departure.utcMs, nowMs));
  const next = all[0] ?? null;

  return {
    routeId,
    dockId,
    destinationDockId: runtime.route.docks[side === 0 ? 1 : 0].id,
    departures: all.filter((departure) => departure.timestamp <= horizonMs),
    next,
    hasMoreToday: next !== null && next.dayOffset === 0,
    scheduleSource: runtime.route.scheduleSource,
  };
}

/**
 * Compatible wrapper: "HH:mm" labels (Amsterdam time) of the next departures from a dock.
 * Empty when nothing departs within the next 3 hours.
 */
export function getNextDeparturesFromDock(routeId: string, dockId: string, count = 5, now?: Date | number): string[] {
  return getDockDepartures(routeId, dockId, { count, now })?.departures.map((departure) => departure.label) ?? [];
}

/** Compatible wrapper: next departures from the route's first dock (route.docks[0]). */
export function getNextDepartures(routeId: string, now?: Date | number): string[] {
  const route = runtimeById.get(routeId)?.route;
  if (!route) return [];
  return getNextDeparturesFromDock(routeId, route.docks[0].id, 5, now);
}

// ---------------------------------------------------------------------------
// Service status

/** Whether the route is within its timetabled service period right now (Amsterdam time). */
export function isRouteInService(routeId: string, now?: Date | number): boolean {
  const runtime = runtimeById.get(routeId);
  if (!runtime || runtime.route.status === "offline") return false;
  return isInServiceWindow(runtime.weeks, runtime.route.duration, toMs(now));
}

export function getRouteServiceStatus(routeId: string, now?: Date | number): RouteServiceStatus | null {
  const runtime = runtimeById.get(routeId);
  if (!runtime) return null;
  const nowMs = toMs(now);
  const inService = isRouteInService(routeId, nowMs);
  let next: FerryDeparture | null = null;
  for (const side of [0, 1] as const) {
    const [raw] = findUpcomingDepartures(runtime.weeks[side], nowMs, 1);
    if (raw && (!next || raw.utcMs < next.timestamp)) next = makeDeparture(runtime, side, raw.utcMs, nowMs);
  }
  return {
    routeId,
    inService,
    status: runtime.route.status === "offline" ? "offline" : inService ? runtime.route.status : "out-of-service",
    next,
  };
}

// ---------------------------------------------------------------------------
// Simulated positions

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function metersBetween(pointA: GeoPoint, pointB: GeoPoint): number {
  const earthRadius = 6371000;
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const haversine = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function bearingDegrees(pointA: GeoPoint, pointB: GeoPoint): number {
  return (Math.atan2(pointB.lng - pointA.lng, pointB.lat - pointA.lat) * 180) / Math.PI;
}

interface PreparedPath {
  points: GeoPoint[];
  segmentLengths: number[];
  segmentHeadings: number[];
  totalLength: number;
  /** Heading while arriving at the last point. */
  arrivalHeading: number;
}

function preparePath(points: GeoPoint[]): PreparedPath {
  const segmentLengths: number[] = [];
  const segmentHeadings: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const length = metersBetween(points[i], points[i + 1]);
    segmentLengths.push(length);
    segmentHeadings.push(bearingDegrees(points[i], points[i + 1]));
    totalLength += length;
  }
  return {
    points,
    segmentLengths,
    segmentHeadings,
    totalLength,
    arrivalHeading: segmentHeadings[segmentHeadings.length - 1] ?? 0,
  };
}

/** Writes lat/lng/heading for `progress` along the path into `target`. */
function placeAlongPath(path: PreparedPath, progress: number, target: FerryPosition): void {
  const { points, segmentLengths, segmentHeadings, totalLength } = path;
  if (points.length < 2 || totalLength === 0) {
    target.lat = points[0].lat;
    target.lng = points[0].lng;
    target.heading = 0;
    return;
  }
  const targetDistance = totalLength * Math.min(1, Math.max(0, progress));
  let travelled = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    const length = segmentLengths[i];
    if (travelled + length >= targetDistance || i === segmentLengths.length - 1) {
      const t = length === 0 ? 0 : Math.min(1, (targetDistance - travelled) / length);
      target.lat = points[i].lat + (points[i + 1].lat - points[i].lat) * t;
      target.lng = points[i].lng + (points[i + 1].lng - points[i].lng) * t;
      target.heading = segmentHeadings[i];
      return;
    }
    travelled += length;
  }
}

interface SimulationRoute {
  runtime: RouteRuntime;
  durationMinutes: number;
  speedKnots: number;
  /** Index 0: sailing docks[0] -> docks[1] ("outbound"); index 1: the reverse ("inbound"). */
  paths: [PreparedPath, PreparedPath];
}

const simulationRoutes: SimulationRoute[] = routeRuntimes.map((runtime) => {
  const durationMinutes = runtime.route.duration > 0 ? runtime.route.duration : DEFAULT_DURATION_MINUTES;
  const outbound = preparePath(runtime.route.path);
  const inbound = preparePath([...runtime.route.path].reverse());
  return {
    runtime,
    durationMinutes,
    speedKnots: outbound.totalLength / 1852 / (durationMinutes / 60),
    paths: [outbound, inbound],
  };
});

/**
 * Boats following real departures: each sailing is on the water from its departure time for
 * `duration` minutes, and waits at its departure dock for 2 minutes before that. Marker ids
 * are derived from the sailing (route, departure dock, service day, minute), so one boat keeps
 * its id from docked-before-departure until arrival.
 *
 * Docked boats use FerryMap's convention: `direction` names the leg that brought the boat to
 * the dock, so a boat at docks[0] is "inbound" and a boat at docks[1] is "outbound".
 */
export function getSimulatedPositions(now?: Date | number): FerryPosition[] {
  const nowMs = toMs(now);
  const positions: FerryPosition[] = [];

  for (const sim of simulationRoutes) {
    const { route, weeks } = sim.runtime;
    if (route.status === "offline") continue;
    const durationMs = sim.durationMinutes * MINUTE_MS;

    for (const side of [0, 1] as const) {
      const departureDock = route.docks[side];
      const path = sim.paths[side];
      forEachDepartureBetween(
        weeks[side],
        nowMs - durationMs,
        nowMs + DOCKED_BEFORE_DEPARTURE_MINUTES * MINUTE_MS,
        (departureMs, serviceDay, minute) => {
          const elapsedMs = nowMs - departureMs;
          if (elapsedMs >= durationMs) return;
          const position: FerryPosition = {
            id: `${route.id}-${departureDock.id}-${serviceDay}-${minute}`,
            routeId: route.id,
            lat: departureDock.lat,
            lng: departureDock.lng,
            heading: 0,
            progress: 0,
            direction: side === 0 ? "outbound" : "inbound",
            speed: 0,
            eta: 0,
            isDocked: false,
            dockId: null,
          };

          if (elapsedMs < 0) {
            // Waiting at the departure dock, facing the way it came in.
            position.isDocked = true;
            position.dockId = departureDock.id;
            position.direction = side === 0 ? "inbound" : "outbound";
            position.heading = sim.paths[side === 0 ? 1 : 0].arrivalHeading;
            position.progress = 1;
          } else {
            const progress = elapsedMs / durationMs;
            placeAlongPath(path, progress, position);
            position.progress = progress;
            position.speed = sim.speedKnots;
            position.eta = Math.max(1, Math.ceil((durationMs - elapsedMs) / MINUTE_MS));
          }
          positions.push(position);
        }
      );
    }
  }

  return positions;
}
