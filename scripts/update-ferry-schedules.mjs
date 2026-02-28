import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const scheduleFilePath = path.join(repoRoot, "src", "data", "ferryScheduleData.ts");
const GVB_TIMETABLE_URL = "https://gvb.nl/en/travel-information/stops-and-timetable";
const GVB_API_BASE = "https://gvb.nl/api/gvb-shared-services/travelinformation/api/v1/Timetable";

const routeDefaults = [
  { id: "f1", frequency: "Every 5 min", duration: 4, operatingHours: "24/7", status: "active" },
  { id: "f2", frequency: "Every 8 min", duration: 5, operatingHours: "06:30 - 00:00", status: "active" },
  { id: "f3", frequency: "Every 10-30 min", duration: 14, operatingHours: "07:00 - 02:00", status: "active" },
  { id: "f4", frequency: "Every 15 min", duration: 6, operatingHours: "06:30 - 22:30 (Mon-Fri)", status: "active" },
  { id: "f5", frequency: "Every 20 min", duration: 6, operatingHours: "06:30 - 22:30", status: "active" },
  { id: "f6", frequency: "Every 20 min", duration: 9, operatingHours: "06:30 - 22:30", status: "active" },
];

const allowedStatuses = new Set(["active", "delayed", "offline"]);
const routeLineMap = [
  { id: "f1", linePlanningNumber: "901" },
  { id: "f2", linePlanningNumber: "902" },
  { id: "f3", linePlanningNumber: "906" },
  { id: "f4", linePlanningNumber: "900" },
  { id: "f5", linePlanningNumber: "915" },
  { id: "f6", linePlanningNumber: "903" },
];

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
  const cadence = "weekly";
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

function parseTimeToMinutes(timeValue) {
  if (typeof timeValue !== "string" || !timeValue.includes(":")) {
    return null;
  }

  const [hoursRaw, minutesRaw] = timeValue.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutesClock(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const minutes = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[center] : Math.round((sorted[center - 1] + sorted[center]) / 2);
}

function deriveFrequencyFromTimeTables(timeTables) {
  const intervals = [];

  for (const day of timeTables ?? []) {
    const dailyMinutes = [];
    for (const hourBlock of day?.hours ?? []) {
      const offset = Number(hourBlock?.departureDayOffset) || 0;
      for (const timeItem of hourBlock?.times ?? []) {
        const minutes = parseTimeToMinutes(timeItem?.time);
        if (minutes !== null) {
          dailyMinutes.push(minutes + offset * 1440);
        }
      }
    }

    dailyMinutes.sort((a, b) => a - b);
    for (let i = 1; i < dailyMinutes.length; i++) {
      const diff = dailyMinutes[i] - dailyMinutes[i - 1];
      if (diff > 0 && diff <= 120) {
        intervals.push(diff);
      }
    }
  }

  if (!intervals.length) {
    return null;
  }

  const counts = new Map();
  for (const interval of intervals) {
    counts.set(interval, (counts.get(interval) ?? 0) + 1);
  }

  const topCount = Math.max(...counts.values());
  const commonIntervals = [...counts.entries()]
    .filter(([, count]) => count >= topCount * 0.35)
    .map(([interval]) => interval)
    .sort((a, b) => a - b);

  const sourceIntervals = commonIntervals.length ? commonIntervals : [...counts.keys()].sort((a, b) => a - b);
  const minInterval = sourceIntervals[0];
  const maxInterval = sourceIntervals[sourceIntervals.length - 1];
  if (minInterval === maxInterval) {
    return `Every ${minInterval} min`;
  }

  return `Every ${minInterval}-${maxInterval} min`;
}

function deriveOperatingHoursFromTimeTables(timeTables) {
  const departures = [];
  const daysWithService = new Set();

  for (const day of timeTables ?? []) {
    const dayDate = day?.date;
    let dayHasService = false;
    for (const hourBlock of day?.hours ?? []) {
      const offset = Number(hourBlock?.departureDayOffset) || 0;
      for (const timeItem of hourBlock?.times ?? []) {
        const minutes = parseTimeToMinutes(timeItem?.time);
        if (minutes !== null) {
          departures.push(minutes + offset * 1440);
          dayHasService = true;
        }
      }
    }

    if (dayHasService && typeof dayDate === "string") {
      daysWithService.add(dayDate.slice(0, 10));
    }
  }

  if (!departures.length) {
    return null;
  }

  const first = Math.min(...departures);
  const last = Math.max(...departures);
  const span = last - first;
  if (daysWithService.size >= 7 && span >= 23 * 60) {
    return "24/7";
  }

  return `${formatMinutesClock(first)} - ${formatMinutesClock(last)}`;
}

function deriveDurationFromJourney(journeyPayload) {
  const durations = [];
  for (const journey of journeyPayload?.simpleJourneys ?? []) {
    if (!Array.isArray(journey) || journey.length < 2) {
      continue;
    }

    const first = journey[0];
    const last = journey[journey.length - 1];
    const departureText = first?.plannedDepartureDatetime ?? first?.actualDepartureDatetime;
    const arrivalText = last?.plannedArrivalDatetime ?? last?.actualArrivalDatetime;
    if (!departureText || !arrivalText) {
      continue;
    }

    const departure = new Date(departureText).getTime();
    const arrival = new Date(arrivalText).getTime();
    if (!Number.isFinite(departure) || !Number.isFinite(arrival)) {
      continue;
    }

    const durationMinutes = Math.round((arrival - departure) / 60000);
    if (durationMinutes > 0 && durationMinutes <= 120) {
      durations.push(durationMinutes);
    }
  }

  return median(durations);
}

async function fetchJsonInPage(page, url) {
  const result = await page.evaluate(async (requestUrl) => {
    const response = await fetch(requestUrl, { credentials: "include" });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text,
    };
  }, url);

  if (!result.ok) {
    throw new Error(`Request failed (${result.status} ${result.statusText}) for ${url}`);
  }

  return JSON.parse(result.text);
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);

  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    startDate: monday.toISOString(),
    endDate: sunday.toISOString(),
    startDateTime: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0))
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
  };
}

async function fetchRouteUpdate(page, mapping) {
  const lineDetailsUrl = `${GVB_API_BASE}/GetLineByNumber?dataOwnerCode=GVB&linePlanningNumber=${encodeURIComponent(mapping.linePlanningNumber)}`;
  const lineDetails = await fetchJsonInPage(page, lineDetailsUrl);
  const route = lineDetails?.routes?.find((candidate) => candidate?.direction === "Outbound") ?? lineDetails?.routes?.[0];

  const stopCode = route?.stops?.[0]?.stopCode;
  const direction = route?.direction;
  if (!stopCode || !direction) {
    throw new Error(`Missing route stop data for line ${mapping.linePlanningNumber}`);
  }

  const { startDate, endDate, startDateTime } = getCurrentWeekRange();
  const timetableUrl =
    `${GVB_API_BASE}/GetTimeTablesForStop?linePlanningNumber=${encodeURIComponent(mapping.linePlanningNumber)}` +
    `&stopCode=${encodeURIComponent(stopCode)}` +
    `&direction=${encodeURIComponent(direction)}` +
    `&startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}`;
  const journeyUrl =
    `${GVB_API_BASE}/GetTimeTableJourneyInTimeColumns?dataOwnerCode=GVB` +
    `&linePlanningNumber=${encodeURIComponent(mapping.linePlanningNumber)}` +
    `&direction=${encodeURIComponent(direction)}` +
    `&startDateTime=${encodeURIComponent(startDateTime)}` +
    `&invertDirections=false`;

  const [timetableData, journeyData] = await Promise.all([
    fetchJsonInPage(page, timetableUrl),
    fetchJsonInPage(page, journeyUrl),
  ]);

  return {
    id: mapping.id,
    frequency: deriveFrequencyFromTimeTables(timetableData?.timeTables),
    operatingHours: deriveOperatingHoursFromTimeTables(timetableData?.timeTables),
    duration: deriveDurationFromJourney(journeyData),
    status: "active",
  };
}

async function fetchRemoteSchedule() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(GVB_TIMETABLE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

    const updates = [];
    for (const mapping of routeLineMap) {
      try {
        const update = await fetchRouteUpdate(page, mapping);
        updates.push(update);
      } catch (error) {
        console.warn(
          `Failed to fetch line ${mapping.linePlanningNumber} for ${mapping.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    return {
      meta: {
        source: "https://gvb.nl/en/travel-information/stops-and-timetable (GVB timetable APIs via browser automation)",
        refreshCadence: "weekly",
        lastUpdated: new Date().toISOString(),
      },
      routes: updates,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

function renderScheduleDataTs(data) {
  const routeBlocks = data.routes
    .map(
      (route) => `    {\n      id: "${escapeString(route.id)}",\n      frequency: "${escapeString(route.frequency)}",\n      duration: ${route.duration},\n      operatingHours: "${escapeString(route.operatingHours)}",\n      status: "${escapeString(route.status)}",\n    },`
    )
    .join("\n");

  return `export type FerryRouteStatus = "active" | "delayed" | "offline";\n\nexport interface FerryScheduleMeta {\n  source: string;\n  lastUpdated: string;\n  refreshCadence: "daily" | "weekly";\n}\n\nexport interface FerryScheduleEntry {\n  id: string;\n  frequency: string;\n  duration: number;\n  operatingHours: string;\n  status: FerryRouteStatus;\n}\n\nexport interface FerryScheduleData {\n  meta: FerryScheduleMeta;\n  routes: FerryScheduleEntry[];\n}\n\nconst ferryScheduleData: FerryScheduleData = {\n  meta: {\n    source: "${escapeString(data.meta.source)}",\n    lastUpdated: "${escapeString(data.meta.lastUpdated)}",\n    refreshCadence: "${escapeString(data.meta.refreshCadence)}",\n  },\n  routes: [\n${routeBlocks}\n  ],\n};\n\nexport default ferryScheduleData;\n`;
}

async function main() {
  const currentContent = await readFile(scheduleFilePath, "utf8");
  const currentData = extractCurrentData(currentContent);

  const payload = await fetchRemoteSchedule();
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
