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
  { id: "cs-east", name: "Centraal Station (East)", lat: 52.3798, lng: 4.9065 },
  { id: "buik", name: "Buiksloterweg", lat: 52.3878, lng: 4.9012 },
  { id: "ndsm", name: "NDSM", lat: 52.4018, lng: 4.8785 },
  { id: "pontsteiger", name: "Pontsteiger", lat: 52.3935, lng: 4.8720 },
  { id: "distel", name: "Distelweg", lat: 52.3920, lng: 4.8830 },
  { id: "ijplein", name: "IJplein", lat: 52.3868, lng: 4.9080 },
  { id: "zamenhof", name: "Zamenhofstraat", lat: 52.3890, lng: 4.9280 },
  { id: "azartplein", name: "Azartplein", lat: 52.3725, lng: 4.9420 },
];

export const ferryRoutes: FerryRoute[] = [
  {
    id: "f1",
    name: "Buiksloterweg",
    code: "F3",
    docks: [
      ferryDocks.find((d) => d.id === "cs")!,
      ferryDocks.find((d) => d.id === "buik")!,
    ],
    color: "#2196F3",
    frequency: "Every 5 min",
    duration: 4,
    operatingHours: "24/7",
    status: "active",
  },
  {
    id: "f2",
    name: "IJplein",
    code: "F2",
    docks: [
      ferryDocks.find((d) => d.id === "cs")!,
      ferryDocks.find((d) => d.id === "ijplein")!,
    ],
    color: "#FF9800",
    frequency: "Every 8 min",
    duration: 5,
    operatingHours: "06:30 - 00:00",
    status: "active",
  },
  {
    id: "f3",
    name: "NDSM",
    code: "F1",
    docks: [
      ferryDocks.find((d) => d.id === "cs")!,
      ferryDocks.find((d) => d.id === "ndsm")!,
    ],
    color: "#E91E63",
    frequency: "Every 15 min",
    duration: 15,
    operatingHours: "06:30 - 00:00",
    status: "active",
  },
  {
    id: "f4",
    name: "Distelweg",
    code: "F4",
    docks: [
      ferryDocks.find((d) => d.id === "pontsteiger")!,
      ferryDocks.find((d) => d.id === "distel")!,
    ],
    color: "#4CAF50",
    frequency: "Every 10 min",
    duration: 5,
    operatingHours: "06:30 - 00:00",
    status: "active",
  },
  {
    id: "f5",
    name: "Zamenhofstraat / Azartplein",
    code: "F5",
    docks: [
      ferryDocks.find((d) => d.id === "cs-east")!,
      ferryDocks.find((d) => d.id === "azartplein")!,
    ],
    color: "#9C27B0",
    frequency: "Every 15 min",
    duration: 10,
    operatingHours: "07:00 - 21:00",
    status: "active",
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
