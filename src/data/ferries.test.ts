// Tests against the real data file. The weekly bot rewrites that file, so these only assert
// properties that hold for any sane GVB timetable; exact-time logic is in timetable.test.ts.
import { describe, expect, it } from "vitest";
import {
  ferryRoutes,
  ferryStations,
  getDockDepartures,
  getDocksAtSameStation,
  getNextDepartures,
  getNextDeparturesFromDock,
  getRouteServiceStatus,
  getScheduleMeta,
  getSimulatedPositions,
  getStationForDock,
  isRouteInService,
} from "@/data/ferries";

const at = (iso: string) => Date.parse(iso);
// Wednesday 2026-11-18 12:00 Amsterdam: every route sails.
const WEDNESDAY_NOON = at("2026-11-18T11:00:00Z");

describe("departures from real data", () => {
  it("returns upcoming departures for both docks of every route", () => {
    for (const route of ferryRoutes) {
      for (const dock of route.docks) {
        const result = getDockDepartures(route.id, dock.id, { now: WEDNESDAY_NOON, count: 4 });
        expect(result, `${route.id} ${dock.id}`).not.toBeNull();
        expect(result.departures.length).toBeGreaterThan(0);
        expect(result.destinationDockId).toBe(route.docks.find((d) => d.id !== dock.id).id);
        let previous = WEDNESDAY_NOON - 1;
        for (const departure of result.departures) {
          expect(departure.label).toMatch(/^\d{2}:\d{2}$/);
          expect(departure.timestamp).toBeGreaterThanOrEqual(previous);
          expect(departure.minutesUntil).toBe(Math.ceil((departure.timestamp - WEDNESDAY_NOON) / 60000));
          previous = departure.timestamp;
        }
      }
    }
  });

  it("returns empty departures but a next sailing when nothing is soon", () => {
    // Wednesday 04:30 Amsterdam: F2 (route f2) does not start until about 06:30.
    const result = getDockDepartures("f2", "cs-east", { now: at("2026-11-18T03:30:00Z"), horizonMinutes: 60 });
    expect(result.departures).toEqual([]);
    expect(result.next).not.toBeNull();
    expect(result.next.dayOffset).toBe(0);
    expect(result.hasMoreToday).toBe(true);
  });

  it("rejects unknown routes and docks a route does not serve", () => {
    expect(getDockDepartures("nope", "cs-east")).toBeNull();
    expect(getDockDepartures("f1", "cs-east")).toBeNull();
    expect(getNextDeparturesFromDock("f1", "cs-east")).toEqual([]);
  });

  it("keeps the old string[] wrappers working", () => {
    const labels = getNextDepartures("f1", WEDNESDAY_NOON);
    expect(labels.length).toBe(5);
    labels.forEach((label) => expect(label).toMatch(/^\d{2}:\d{2}$/));
    expect(getNextDeparturesFromDock("f1", "buik", 3, WEDNESDAY_NOON)).toHaveLength(3);
  });

  it("gives the same answer for the same instant regardless of how it is expressed", () => {
    const fromNumber = getDockDepartures("f3", "ndsm", { now: WEDNESDAY_NOON });
    const fromDate = getDockDepartures("f3", "ndsm", { now: new Date("2026-11-18T13:00:00+02:00") });
    expect(fromDate.departures.map((d) => d.label)).toEqual(fromNumber.departures.map((d) => d.label));
  });
});

describe("service status", () => {
  it("F3 (f1) runs through the night, F2 (f2) does not", () => {
    const threeAm = at("2026-11-18T02:00:00Z"); // Wednesday 03:00 Amsterdam
    expect(isRouteInService("f1", threeAm)).toBe(true);
    expect(isRouteInService("f2", threeAm)).toBe(false);
    expect(getRouteServiceStatus("f2", threeAm)).toMatchObject({ inService: false, status: "out-of-service" });
    expect(getRouteServiceStatus("f2", threeAm).next).not.toBeNull();
    expect(isRouteInService("f2", WEDNESDAY_NOON)).toBe(true);
  });
});

describe("simulated positions", () => {
  it("keeps marker ids stable across nearby instants", () => {
    const first = getSimulatedPositions(WEDNESDAY_NOON);
    const second = getSimulatedPositions(WEDNESDAY_NOON + 5000);
    expect(first.length).toBeGreaterThan(0);
    const secondIds = new Set(second.map((p) => p.id));
    // Every boat that is not about to arrive is still there 5 s later.
    for (const position of first) {
      if (!position.isDocked && position.eta <= 1) continue;
      expect(secondIds.has(position.id), position.id).toBe(true);
    }
    expect(new Set(first.map((p) => p.id)).size).toBe(first.length);
  });

  it("keeps the same id from waiting at the dock to sailing", () => {
    const [next] = getDockDepartures("f1", "buik", { now: WEDNESDAY_NOON }).departures;
    const docked = getSimulatedPositions(next.timestamp - 60_000).find((p) => p.dockId === "buik" && p.isDocked);
    expect(docked).toBeDefined();
    expect(docked.direction).toBe("outbound"); // FerryMap shows docks[1] for docked + outbound
    const sailing = getSimulatedPositions(next.timestamp + 60_000).find((p) => p.id === docked.id);
    expect(sailing).toMatchObject({ isDocked: false, dockId: null, direction: "inbound" });
    expect(sailing.progress).toBeGreaterThan(0);
  });

  it("shows no boats for a route outside its service hours", () => {
    const positions = getSimulatedPositions(at("2026-11-18T02:00:00Z")); // 03:00 Amsterdam
    expect(positions.some((p) => p.routeId === "f2")).toBe(false);
    expect(positions.some((p) => p.routeId === "f1")).toBe(true);
  });
});

describe("stations", () => {
  it("merges the two Centraal Station IJ docks but not CS East", () => {
    expect(getDocksAtSameStation("cs-ndsm").map((d) => d.id).sort()).toEqual(["cs-buik", "cs-ndsm"]);
    expect(getDocksAtSameStation("cs-east").map((d) => d.id)).toEqual(["cs-east"]);
    expect(getStationForDock("cs-buik")?.dockIds.sort()).toEqual(["cs-buik", "cs-ndsm"]);
    expect(ferryStations).toHaveLength(9);
    expect(getDocksAtSameStation("unknown")).toEqual([]);
  });
});

describe("schedule meta", () => {
  it("exposes lastChecked separately from lastUpdated", () => {
    const meta = getScheduleMeta();
    expect(Number.isFinite(Date.parse(meta.lastUpdated))).toBe(true);
    expect(Number.isFinite(Date.parse(meta.lastChecked))).toBe(true);
    expect(Date.parse(meta.lastChecked)).toBeGreaterThanOrEqual(Date.parse(meta.lastUpdated));
  });
});
