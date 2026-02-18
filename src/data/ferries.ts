import ferryScheduleData, {
  type FerryRouteStatus,
  type FerryScheduleEntry,
  type FerryScheduleMeta,
} from "@/data/ferryScheduleData";

export interface FerryDock {
  id: string;
  name: string;
  lat: number;
  lng: number;
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
  status: FerryRouteStatus;
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

const DOCK_STOP_MINUTES = 0;
const SIMULATION_TIME_SCALE = 12;

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
  { id: "cs-ndsm", name: "Centraal Station", lat: 52.38084352843545, lng: 4.89917802825759 },
  { id: "cs-buik", name: "Centraal Station", lat: 52.3807188117236, lng: 4.899427901507475 },
  { id: "cs-east", name: "Centraal Station (East)", lat: 52.37849693865851, lng: 4.90558612881542 },
  { id: "buik", name: "Buiksloterweg", lat: 52.382235464529835, lng: 4.903109850398619 },
  { id: "ndsm", name: "NDSM", lat: 52.4013290166148, lng: 4.890924271312947 },
  { id: "pontsteiger", name: "Pontsteiger", lat: 52.39267111816572, lng: 4.886411014175174 },
  { id: "distel", name: "Distelweg", lat: 52.39578749178729, lng: 4.89649611976632 },
  { id: "ijplein", name: "IJplein", lat: 52.38171899630089, lng: 4.908356748760325 },
  { id: "zamenhof", name: "Zamenhofstraat", lat: 52.38481138360226, lng: 4.930879460839123 },
  { id: "azartplein", name: "Azartplein", lat: 52.37770533239611, lng: 4.937446977362498 },
];

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
    defaults: {
      frequency: "Every 5 min",
      duration: 4,
      operatingHours: "24/7",
      status: "active",
    },
  },
  {
    id: "f2",
    name: "IJplein",
    code: "F2",
    dockIds: ["cs-east", "ijplein"],
    color: "#FF9800",
    defaults: {
      frequency: "Every 8 min",
      duration: 5,
      operatingHours: "06:30 - 00:00",
      status: "active",
    },
  },
  {
    id: "f3",
    name: "NDSM",
    code: "F4",
    dockIds: ["cs-ndsm", "ndsm"],
    color: "#E91E63",
    defaults: {
      frequency: "Every 10-30 min",
      duration: 14,
      operatingHours: "07:00 - 02:00",
      status: "active",
    },
  },
  {
    id: "f4",
    name: "Distelweg",
    code: "F6",
    dockIds: ["pontsteiger", "distel"],
    color: "#4CAF50",
    defaults: {
      frequency: "Every 15 min",
      duration: 6,
      operatingHours: "06:30 - 19:30 (Mon-Fri)",
      status: "active",
    },
  },
  {
    id: "f5",
    name: "Zamenhofstraat / Azartplein",
    code: "F1",
    dockIds: ["azartplein", "zamenhof"],
    color: "#9C27B0",
    defaults: {
      frequency: "Every 20 min",
      duration: 6,
      operatingHours: "06:30 - 22:30",
      status: "active",
    },
  },
  {
    id: "f6",
    name: "NDSM",
    code: "F7",
    dockIds: ["pontsteiger", "ndsm"],
    color: "#03A9F4",
    defaults: {
      frequency: "Every 20 min",
      duration: 9,
      operatingHours: "06:30 - 22:30",
      status: "active",
    },
  },
];

const routeScheduleById = new Map<string, FerryScheduleEntry>(
  ferryScheduleData.routes.map((r) => [r.id, r])
);

export const ferryRoutes: FerryRoute[] = baseRoutes.map((baseRoute) => {
  const [dockA, dockB] = baseRoute.dockIds.map(
    (dockId) => ferryDocks.find((dock) => dock.id === dockId) as FerryDock
  ) as [FerryDock, FerryDock];
  const schedule = routeScheduleById.get(baseRoute.id) ?? {
    id: baseRoute.id,
    ...baseRoute.defaults,
  };

  return {
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
  };
});

function buildRoutePath(routeId: string, dockA: FerryDock, dockB: FerryDock): GeoPoint[] {
  const waypoints = routeWaypoints[routeId] ?? [];
  return [
    { lat: dockA.lat, lng: dockA.lng },
    ...waypoints.map(([lat, lng]) => ({ lat, lng })),
    { lat: dockB.lat, lng: dockB.lng },
  ];
}

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
  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * arc;
}

function bearingDegrees(pointA: GeoPoint, pointB: GeoPoint): number {
  return (Math.atan2(pointB.lng - pointA.lng, pointB.lat - pointA.lat) * 180) / Math.PI;
}

function getPathMetrics(path: GeoPoint[]): { totalLength: number; segments: number[] } {
  const segments: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const segmentLength = metersBetween(path[i], path[i + 1]);
    segments.push(segmentLength);
    totalLength += segmentLength;
  }

  return { totalLength, segments };
}

function interpolateAlongPath(path: GeoPoint[], progress: number): { lat: number; lng: number; heading: number } {
  if (path.length < 2) {
    return { lat: path[0].lat, lng: path[0].lng, heading: 0 };
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const { totalLength, segments } = getPathMetrics(path);
  if (totalLength === 0) {
    return { lat: path[0].lat, lng: path[0].lng, heading: 0 };
  }

  const targetDistance = totalLength * clamped;
  let travelled = 0;

  for (let i = 0; i < segments.length; i++) {
    const segmentLength = segments[i];
    const segmentStart = path[i];
    const segmentEnd = path[i + 1];

    if (travelled + segmentLength >= targetDistance) {
      const segmentProgress = segmentLength === 0 ? 0 : (targetDistance - travelled) / segmentLength;
      const lat = segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segmentProgress;
      const lng = segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segmentProgress;
      return { lat, lng, heading: bearingDegrees(segmentStart, segmentEnd) };
    }

    travelled += segmentLength;
  }

  const lastIndex = path.length - 1;
  return {
    lat: path[lastIndex].lat,
    lng: path[lastIndex].lng,
    heading: bearingDegrees(path[lastIndex - 1], path[lastIndex]),
  };
}

function parseFrequencyMinutes(frequency: string): number {
  return parseInt(frequency.match(/\d+/)?.[0] ?? "10", 10);
}

export function getScheduleMeta(): FerryScheduleMeta {
  return ferryScheduleData.meta;
}

// Simulate ferry positions with a dock stop at each end of the route.
export function getSimulatedPositions(): FerryPosition[] {
  const now = Date.now() * SIMULATION_TIME_SCALE;

  return ferryRoutes
    .filter((route) => route.status !== "offline")
    .flatMap((route) => {
      const [dockA, dockB] = route.docks;
      const outboundPath = route.path;
      const inboundPath = [...route.path].reverse();

      const travelMs = route.duration * 60 * 1000;
      const dockMs = DOCK_STOP_MINUTES * 60 * 1000;
      const cycleMs = travelMs * 2 + dockMs * 2;
      const routeLengthMeters = getPathMetrics(outboundPath).totalLength;
      const averageSpeedKnots = route.duration > 0 ? (routeLengthMeters / 1852) / (route.duration / 60) : 0;

      const buildFerry = (index: number, offsetMs: number): FerryPosition => {
        const phase = (now + offsetMs) % cycleMs;

        if (phase < travelMs) {
          const legProgress = phase / travelMs;
          const point = interpolateAlongPath(outboundPath, legProgress);
          return {
            id: `${route.id}-${index + 1}`,
            routeId: route.id,
            lat: point.lat,
            lng: point.lng,
            heading: point.heading,
            progress: legProgress,
            direction: "outbound",
            speed: averageSpeedKnots + Math.sin(now / 4500 + index) * 0.7,
            eta: Math.max(1, Math.round((travelMs - phase) / 60000)),
            isDocked: false,
            dockId: null,
          };
        }

        if (phase < travelMs + dockMs) {
          const outboundHeading = bearingDegrees(outboundPath[outboundPath.length - 1], outboundPath[outboundPath.length - 2]);
          return {
            id: `${route.id}-${index + 1}`,
            routeId: route.id,
            lat: dockB.lat,
            lng: dockB.lng,
            heading: outboundHeading,
            progress: 1,
            direction: "outbound",
            speed: 0,
            eta: 0,
            isDocked: true,
            dockId: dockB.id,
          };
        }

        if (phase < travelMs * 2 + dockMs) {
          const inboundPhase = phase - travelMs - dockMs;
          const legProgress = inboundPhase / travelMs;
          const point = interpolateAlongPath(inboundPath, legProgress);
          return {
            id: `${route.id}-${index + 1}`,
            routeId: route.id,
            lat: point.lat,
            lng: point.lng,
            heading: point.heading,
            progress: legProgress,
            direction: "inbound",
            speed: averageSpeedKnots + Math.sin(now / 4500 + index + 1) * 0.7,
            eta: Math.max(1, Math.round((travelMs - inboundPhase) / 60000)),
            isDocked: false,
            dockId: null,
          };
        }

        const inboundHeading = bearingDegrees(inboundPath[inboundPath.length - 1], inboundPath[inboundPath.length - 2]);
        return {
          id: `${route.id}-${index + 1}`,
          routeId: route.id,
          lat: dockA.lat,
          lng: dockA.lng,
          heading: inboundHeading,
          progress: 1,
          direction: "inbound",
          speed: 0,
          eta: 0,
          isDocked: true,
          dockId: dockA.id,
        };
      };

      return [buildFerry(0, 0), buildFerry(1, cycleMs / 2)];
    });
}

export function getNextDepartures(routeId: string): string[] {
  const now = new Date();
  const departures: string[] = [];
  const route = ferryRoutes.find((r) => r.id === routeId);
  if (!route) return [];

  const frequencyMinutes = parseFrequencyMinutes(route.frequency);
  const currentMinutes = now.getMinutes();
  const nextSlot = Math.ceil(currentMinutes / frequencyMinutes) * frequencyMinutes;

  for (let i = 0; i < 5; i++) {
    const departure = new Date(now);
    departure.setMinutes(nextSlot + i * frequencyMinutes);
    departure.setSeconds(0);
    departures.push(
      departure.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
    );
  }

  return departures;
}
