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
  // Centraal Station ferry dock for NDSM route (F4)
  { id: "cs-ndsm", name: "Centraal Station", lat: 52.38084352843545, lng: 4.89917802825759 },
  // Centraal Station ferry dock for Buiksloterweg route (F3)
  { id: "cs-buik", name: "Centraal Station", lat: 52.3807188117236, lng: 4.899427901507475 },
  // Centraal Station East ferry dock for IJplein route (F2)
  { id: "cs-east", name: "Centraal Station (East)", lat: 52.37849693865851, lng: 4.90558612881542 },
  // Buiksloterweg ferry dock (north shore of IJ)
  { id: "buik", name: "Buiksloterweg", lat: 52.382235464529835, lng: 4.903109850398619 },
  // NDSM ferry dock (NDSM wharf area)
  { id: "ndsm", name: "NDSM", lat: 52.4013290166148, lng: 4.890924271312947 },
  // Pontsteiger ferry dock (Houthavens area, Tasmanstraat)
  { id: "pontsteiger", name: "Pontsteiger", lat: 52.39267111816572, lng: 4.886411014175174 },
  // Distelweg ferry dock (Amsterdam-Noord, west side)
  { id: "distel", name: "Distelweg", lat: 52.39578749178729, lng: 4.89649611976632 },
  // IJplein ferry dock (IJplein area, Meeuwenlaan)
  { id: "ijplein", name: "IJplein", lat: 52.38171899630089, lng: 4.908356748760325 },
  // Zamenhofstraat ferry dock (Amsterdam-Noord, east side)
  { id: "zamenhof", name: "Zamenhofstraat", lat: 52.38481138360226, lng: 4.930879460839123 },
  // Azartplein ferry dock (Oostelijk Havengebied, Java/KNSM Island)
  { id: "azartplein", name: "Azartplein", lat: 52.37770533239611, lng: 4.937446977362498 },
];

export const ferryRoutes: FerryRoute[] = [
  {
    id: "f1",
    name: "Buiksloterweg",
    code: "F3",
    docks: [
      ferryDocks.find((d) => d.id === "cs-buik")!,
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
      ferryDocks.find((d) => d.id === "cs-east")!,
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
    code: "F4",
    docks: [
      ferryDocks.find((d) => d.id === "cs-ndsm")!,
      ferryDocks.find((d) => d.id === "ndsm")!,
    ],
    color: "#E91E63",
    frequency: "Every 10-30 min",
    duration: 14,
    operatingHours: "07:00 - 02:00",
    status: "active",
  },
  {
    id: "f4",
    name: "Distelweg",
    code: "F6",
    docks: [
      ferryDocks.find((d) => d.id === "pontsteiger")!,
      ferryDocks.find((d) => d.id === "distel")!,
    ],
    color: "#4CAF50",
    frequency: "Every 15 min",
    duration: 6,
    operatingHours: "06:30 - 19:30 (Mon-Fri)",
    status: "active",
  },
  {
    id: "f5",
    name: "Zamenhofstraat / Azartplein",
    code: "F1",
    docks: [
      ferryDocks.find((d) => d.id === "azartplein")!,
      ferryDocks.find((d) => d.id === "zamenhof")!,
    ],
    color: "#9C27B0",
    frequency: "Every 20 min",
    duration: 6,
    operatingHours: "06:30 - 22:30",
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
