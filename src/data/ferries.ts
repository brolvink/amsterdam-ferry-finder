export interface FerryDock {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface FerryRoute {
  id: string;
  name: string;
  code: string;
  docks: [FerryDock, FerryDock];
  color: string;
  frequency: string;
  duration: number; // minutes
  operatingHours: string;
  status: "active" | "delayed" | "offline";
}

export interface FerryPosition {
  routeId: string;
  lat: number;
  lng: number;
  heading: number; // degrees
  progress: number; // 0-1
  direction: "outbound" | "inbound";
  speed: number; // knots
  eta: number; // minutes
}

export const ferryDocks: FerryDock[] = [
  { id: "cs", name: "Centraal Station", lat: 52.3812, lng: 4.9013 },
  { id: "buik", name: "Buiksloterweg", lat: 52.3878, lng: 4.9012 },
  { id: "ndsm", name: "NDSM-werf", lat: 52.4012, lng: 4.8915 },
  { id: "ijplein", name: "IJplein", lat: 52.3878, lng: 4.9105 },
  { id: "zamenhof", name: "Zamenhofstraat", lat: 52.3905, lng: 4.9210 },
  { id: "azartplein", name: "Azartplein", lat: 52.3750, lng: 4.9385 },
  { id: "distel", name: "Distelweg", lat: 52.3910, lng: 4.8850 },
];

export const ferryRoutes: FerryRoute[] = [
  {
    id: "f1",
    name: "Buiksloterweg",
    code: "BUK-901",
    docks: [
      ferryDocks.find((d) => d.id === "cs")!,
      ferryDocks.find((d) => d.id === "buik")!,
    ],
    color: "#00ff41",
    frequency: "Every 5 min",
    duration: 3,
    operatingHours: "24/7",
    status: "active",
  },
  {
    id: "f2",
    name: "NDSM-werf",
    code: "NDSM-902",
    docks: [
      ferryDocks.find((d) => d.id === "cs")!,
      ferryDocks.find((d) => d.id === "ndsm")!,
    ],
    color: "#00d4ff",
    frequency: "Every 15 min",
    duration: 12,
    operatingHours: "06:30 - 00:00",
    status: "active",
  },
  {
    id: "f3",
    name: "IJplein",
    code: "IJP-903",
    docks: [
      ferryDocks.find((d) => d.id === "cs")!,
      ferryDocks.find((d) => d.id === "ijplein")!,
    ],
    color: "#ff6b00",
    frequency: "Every 8 min",
    duration: 5,
    operatingHours: "06:30 - 00:00",
    status: "active",
  },
  {
    id: "f4",
    name: "Distelweg",
    code: "DST-904",
    docks: [
      ferryDocks.find((d) => d.id === "cs")!,
      ferryDocks.find((d) => d.id === "distel")!,
    ],
    color: "#ff00ff",
    frequency: "Every 20 min",
    duration: 8,
    operatingHours: "07:00 - 21:00",
    status: "delayed",
  },
];

// Simulate ferry positions based on time
export function getSimulatedPositions(): FerryPosition[] {
  const now = Date.now();

  return ferryRoutes
    .filter((r) => r.status !== "offline")
    .flatMap((route) => {
      const [dockA, dockB] = route.docks;
      const cycleMs = route.duration * 60 * 1000;
      const offset1 = (now % (cycleMs * 2)) / (cycleMs * 2);
      const offset2 = ((now + cycleMs) % (cycleMs * 2)) / (cycleMs * 2);

      const makeFerry = (offset: number): FerryPosition => {
        const outbound = offset < 0.5;
        const progress = outbound ? offset * 2 : (offset - 0.5) * 2;
        const fromDock = outbound ? dockA : dockB;
        const toDock = outbound ? dockB : dockA;

        const lat = fromDock.lat + (toDock.lat - fromDock.lat) * progress;
        const lng = fromDock.lng + (toDock.lng - fromDock.lng) * progress;

        const heading =
          (Math.atan2(toDock.lng - fromDock.lng, toDock.lat - fromDock.lat) *
            180) /
          Math.PI;

        return {
          routeId: route.id,
          lat,
          lng,
          heading,
          progress,
          direction: outbound ? "outbound" : "inbound",
          speed: 6 + Math.sin(now / 3000) * 1.5,
          eta: Math.round(route.duration * (1 - progress)),
        };
      };

      return [makeFerry(offset1), makeFerry(offset2)];
    });
}

export function getNextDepartures(routeId: string): string[] {
  const now = new Date();
  const departures: string[] = [];
  const route = ferryRoutes.find((r) => r.id === routeId);
  if (!route) return [];

  const freqMin = parseInt(route.frequency.match(/\d+/)?.[0] || "10");
  const baseMin = now.getMinutes();
  const nextSlot = Math.ceil(baseMin / freqMin) * freqMin;

  for (let i = 0; i < 5; i++) {
    const d = new Date(now);
    d.setMinutes(nextSlot + i * freqMin);
    d.setSeconds(0);
    departures.push(
      d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
    );
  }
  return departures;
}
