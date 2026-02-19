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

const SIMULATION_TIME_SCALE = 1;

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
  { id: "cs-east", name: "Centraal Station (East)", lat: 52.3784191027723, lng: 4.9055495479905 },
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
      frequency: "Every 10 min",
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
      operatingHours: "06:30 - 22:30 (Mon-Fri)",
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
  // Take the lower bound for ranges like "10-30 min"
  return parseInt(frequency.match(/\d+/)?.[0] ?? "10", 10);
}

export function getScheduleMeta(): FerryScheduleMeta {
  return ferryScheduleData.meta;
}

function isRouteOperating(route: FerryRoute, now: Date): boolean {
  if (route.operatingHours === "24/7") return true;

  // Check day of week for (Mon-Fri)
  const dayMatch = route.operatingHours.match(/\((.*?)\)/);
  if (dayMatch) {
    const dayLimit = dayMatch[1];
    const day = now.getDay(); // 0 is Sunday, 1-5 is Mon-Fri
    if (dayLimit === "Mon-Fri" && (day === 0 || day === 6)) return false;
  }

  // Check HH:mm - HH:mm
  const match = route.operatingHours.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!match) return true;

  const [_, startStr, endStr] = match;
  const currentTimeStr = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

  if (startStr <= endStr) {
    return currentTimeStr >= startStr && currentTimeStr < endStr;
  } else {
    // Over midnight e.g. 07:00 - 02:00
    return currentTimeStr >= startStr || currentTimeStr < endStr;
  }
}

// Simulate ferry positions following the real-world schedule.
// Ferries depart from Dock A on every 'frequency' minute (e.g., 20:00, 20:05).
// They arrive at Dock B 'duration' minutes later, wait for a gap, 
// then return to Dock A in time for a later departure slot.
export function getSimulatedPositions(): FerryPosition[] {
  const now = Date.now() * SIMULATION_TIME_SCALE;
  const wallNow = new Date(now);
  const wallClockMinutes = now / (60 * 1000);

  return ferryRoutes
    .filter((route) => route.status !== "offline" && isRouteOperating(route, wallNow))
    .flatMap((route) => {
      const [dockA, dockB] = route.docks;
      const frequency = parseFrequencyMinutes(route.frequency);
      const sailingDuration = route.duration;

      // Calculate how many ferries are needed to sustain this frequency.
      // We need enough ferries so that a round trip (2*duration + 2*dockTime) 
      // fits into the combined schedule slots.
      // Min dock time is 1 min as per user requirement.
      const roundTripMin = 2 * (sailingDuration + 1);
      const numFerries = Math.ceil(roundTripMin / frequency);
      const cycleMinutes = numFerries * frequency;
      const legDuration = cycleMinutes / 2; // Time between departing A and departing B

      const outboundPath = route.path;
      const inboundPath = [...route.path].reverse();
      const routeLengthMeters = getPathMetrics(outboundPath).totalLength;
      const averageSpeedKnots = sailingDuration > 0 ? (routeLengthMeters / 1852) / (sailingDuration / 60) : 0;

      const ferries: FerryPosition[] = [];
      for (let i = 0; i < numFerries; i++) {
        // Each ferry is offset by some multiple of 'frequency'
        const ferryOffset = i * frequency;

        // Time in the ferry's own cycle (0 to cycleMinutes)
        // We sync to the wall clock so departure from A happens at t % cycleMinutes == 0 (for ferry 0)
        let ferryTime = (wallClockMinutes - ferryOffset) % cycleMinutes;
        if (ferryTime < 0) ferryTime += cycleMinutes;

        let pos: FerryPosition;

        if (ferryTime < sailingDuration) {
          // Leg 1: Sailing A -> B
          const progress = ferryTime / sailingDuration;
          const point = interpolateAlongPath(outboundPath, progress);
          pos = {
            id: `${route.id}-${i + 1}`,
            routeId: route.id,
            lat: point.lat,
            lng: point.lng,
            heading: point.heading,
            progress,
            direction: "outbound",
            speed: averageSpeedKnots,
            eta: Math.max(1, Math.round(sailingDuration - ferryTime)),
            isDocked: false,
            dockId: null,
          };
        } else if (ferryTime < legDuration) {
          // Docked at B
          const heading = bearingDegrees(outboundPath[outboundPath.length - 2], outboundPath[outboundPath.length - 1]);
          pos = {
            id: `${route.id}-${i + 1}`,
            routeId: route.id,
            lat: dockB.lat,
            lng: dockB.lng,
            heading: heading,
            progress: 1,
            direction: "outbound",
            speed: 0,
            eta: 0,
            isDocked: true,
            dockId: dockB.id,
          };
        } else if (ferryTime < legDuration + sailingDuration) {
          // Leg 2: Sailing B -> A
          const legProgress = (ferryTime - legDuration) / sailingDuration;
          const point = interpolateAlongPath(inboundPath, legProgress);
          pos = {
            id: `${route.id}-${i + 1}`,
            routeId: route.id,
            lat: point.lat,
            lng: point.lng,
            heading: point.heading,
            progress: legProgress,
            direction: "inbound",
            speed: averageSpeedKnots,
            eta: Math.max(1, Math.round(sailingDuration - (ferryTime - legDuration))),
            isDocked: false,
            dockId: null,
          };
        } else {
          // Docked at A
          const heading = bearingDegrees(inboundPath[inboundPath.length - 2], inboundPath[inboundPath.length - 1]);
          pos = {
            id: `${route.id}-${i + 1}`,
            routeId: route.id,
            lat: dockA.lat,
            lng: dockA.lng,
            heading: heading,
            progress: 1,
            direction: "inbound",
            speed: 0,
            eta: 0,
            isDocked: true,
            dockId: dockA.id,
          };
        }
        ferries.push(pos);
      }
      return ferries;
    });
}

export function getNextDepartures(routeId: string): string[] {
  const route = ferryRoutes.find((r) => r.id === routeId);
  if (!route) return [];

  return getNextDeparturesFromDock(routeId, route.docks[0].id);
}

export function getNextDeparturesFromDock(routeId: string, dockId: string, count = 5): string[] {
  const route = ferryRoutes.find((r) => r.id === routeId);
  if (!route) return [];
  if (!route.docks.some((dock) => dock.id === dockId)) return [];

  const frequencyMinutes = parseFrequencyMinutes(route.frequency);
  const frequencyMs = frequencyMinutes * 60 * 1000;
  const nowMs = Date.now();
  const offsetMs = getDockDepartureOffsetMinutes(route, dockId) * 60 * 1000;
  const cycleIndex = Math.floor((nowMs - offsetMs) / frequencyMs);
  const nextBaseMs = offsetMs + (cycleIndex + 1) * frequencyMs;

  const departures: string[] = [];
  for (let i = 0; i < count; i++) {
    const departure = new Date(nextBaseMs + i * frequencyMs);
    departures.push(
      departure.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
    );
  }

  return departures;
}

function getDockDepartureOffsetMinutes(route: FerryRoute, dockId: string): number {
  if (route.docks[0].id === dockId) return 0;

  const frequency = parseFrequencyMinutes(route.frequency);
  const roundTripMinutes = 2 * (route.duration + 1);
  const ferryCount = Math.ceil(roundTripMinutes / frequency);
  return (ferryCount * frequency) / 2;
}
