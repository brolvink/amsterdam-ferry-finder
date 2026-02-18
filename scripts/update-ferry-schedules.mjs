import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const scheduleFilePath = path.join(repoRoot, "src", "data", "ferryScheduleData.ts");

const routeDefaults = [
  { id: "f1", frequency: "Every 5 min", duration: 4, operatingHours: "24/7", status: "active" },
  { id: "f2", frequency: "Every 8 min", duration: 5, operatingHours: "06:30 - 00:00", status: "active" },
  { id: "f3", frequency: "Every 10-30 min", duration: 14, operatingHours: "07:00 - 02:00", status: "active" },
  { id: "f4", frequency: "Every 15 min", duration: 6, operatingHours: "06:30 - 19:30 (Mon-Fri)", status: "active" },
  { id: "f5", frequency: "Every 20 min", duration: 6, operatingHours: "06:30 - 22:30", status: "active" },
  { id: "f6", frequency: "Every 20 min", duration: 9, operatingHours: "06:30 - 22:30", status: "active" },
];

const allowedStatuses = new Set(["active", "delayed", "offline"]);

function escapeString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function extractCurrentData(tsContent) {
  const match = tsContent.match(/const ferryScheduleData: FerryScheduleData = (\{[\s\S]*\});\n\nexport default ferryScheduleData;/m);
  if (!match) {
    throw new Error("Could not parse current ferry schedule file.");
  }

  // Controlled local file content; evaluate object literal to preserve existing metadata.
  return new Function(`return (${match[1]});`)();
}

function normalizeRoute(rawRoute, fallback) {
  const duration = Number(rawRoute?.duration);
  const status = typeof rawRoute?.status === "string" ? rawRoute.status : fallback.status;

  return {
    id: fallback.id,
    frequency:
      typeof rawRoute?.frequency === "string" && rawRoute.frequency.trim().length > 0
        ? rawRoute.frequency.trim()
        : fallback.frequency,
    duration: Number.isFinite(duration) && duration > 0 ? duration : fallback.duration,
    operatingHours:
      typeof rawRoute?.operatingHours === "string" && rawRoute.operatingHours.trim().length > 0
        ? rawRoute.operatingHours.trim()
        : fallback.operatingHours,
    status: allowedStatuses.has(status) ? status : fallback.status,
  };
}

function normalizeIncomingData(payload, currentData) {
  const cadence = process.env.FERRY_SCHEDULE_REFRESH_CADENCE === "daily" ? "daily" : "weekly";
  const source =
    payload?.meta?.source ??
    payload?.source ??
    currentData?.meta?.source ??
    "GVB official timetable (auto-synced)";

  let incomingRoutes = [];
  if (Array.isArray(payload?.routes)) {
    incomingRoutes = payload.routes;
  } else if (payload?.routes && typeof payload.routes === "object") {
    incomingRoutes = Object.entries(payload.routes).map(([id, route]) => ({ id, ...route }));
  } else if (Array.isArray(payload)) {
    incomingRoutes = payload;
  }

  const routeMap = new Map(incomingRoutes.map((route) => [route.id, route]));
  const routes = routeDefaults.map((fallback) => normalizeRoute(routeMap.get(fallback.id), fallback));

  return {
    meta: {
      source,
      refreshCadence: cadence,
      lastUpdated:
        payload?.meta?.lastUpdated ??
        payload?.lastUpdated ??
        new Date().toISOString(),
    },
    routes,
  };
}

function renderScheduleDataTs(data) {
  const routeBlocks = data.routes
    .map(
      (route) => `    {\n      id: "${escapeString(route.id)}",\n      frequency: "${escapeString(route.frequency)}",\n      duration: ${route.duration},\n      operatingHours: "${escapeString(route.operatingHours)}",\n      status: "${escapeString(route.status)}",\n    },`
    )
    .join("\n");

  return `export type FerryRouteStatus = "active" | "delayed" | "offline";\n\nexport interface FerryScheduleMeta {\n  source: string;\n  lastUpdated: string;\n  refreshCadence: "daily" | "weekly";\n}\n\nexport interface FerryScheduleEntry {\n  id: string;\n  frequency: string;\n  duration: number;\n  operatingHours: string;\n  status: FerryRouteStatus;\n}\n\nexport interface FerryScheduleData {\n  meta: FerryScheduleMeta;\n  routes: FerryScheduleEntry[];\n}\n\nconst ferryScheduleData: FerryScheduleData = {\n  meta: {\n    source: "${escapeString(data.meta.source)}",\n    lastUpdated: "${escapeString(data.meta.lastUpdated)}",\n    refreshCadence: "${escapeString(data.meta.refreshCadence)}",\n  },\n  routes: [\n${routeBlocks}\n  ],\n};\n\nexport default ferryScheduleData;\n`;
}

async function fetchRemoteSchedule() {
  const url = process.env.FERRY_SCHEDULE_SOURCE_URL;
  if (!url) {
    console.log("Skipping ferry schedule update: FERRY_SCHEDULE_SOURCE_URL is not set.");
    return null;
  }

  const headers = {};
  if (process.env.FERRY_SCHEDULE_SOURCE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.FERRY_SCHEDULE_SOURCE_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch schedule data (${response.status} ${response.statusText}).`);
  }

  return response.json();
}

async function main() {
  const currentContent = await readFile(scheduleFilePath, "utf8");
  const currentData = extractCurrentData(currentContent);

  const payload = await fetchRemoteSchedule();
  if (!payload) {
    return;
  }

  const nextData = normalizeIncomingData(payload, currentData);
  const currentComparable = JSON.stringify({
    meta: {
      source: currentData.meta.source,
      refreshCadence: currentData.meta.refreshCadence,
    },
    routes: currentData.routes,
  });
  const nextComparable = JSON.stringify({
    meta: {
      source: nextData.meta.source,
      refreshCadence: nextData.meta.refreshCadence,
    },
    routes: nextData.routes,
  });

  if (currentComparable === nextComparable) {
    console.log("No schedule changes detected.");
    return;
  }

  await writeFile(scheduleFilePath, renderScheduleDataTs(nextData), "utf8");
  console.log("Ferry schedule data updated.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
