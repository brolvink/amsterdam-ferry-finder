// What is open on the screen (a station card or a route card), how it maps to the URL
// (?dock=<station id> / ?route=<public code>) and how a favourite is stored.

import { ferryRoutes, ferryStations, type FerryRoute, type FerryStation } from "@/data/ferries";

export type Selection =
  | { kind: "station"; id: string }
  | { kind: "route"; id: string };

export const DOCK_PARAM = "dock";
export const ROUTE_PARAM = "route";

export function selectionEquals(a: Selection | null, b: Selection | null): boolean {
  return a === b || (a !== null && b !== null && a.kind === b.kind && a.id === b.id);
}

function findStation(id: string): FerryStation | undefined {
  return ferryStations.find((station) => station.id === id);
}

function findRoute(id: string): FerryRoute | undefined {
  return ferryRoutes.find((route) => route.id === id);
}

/** Reads ?dock= / ?route= (case-insensitive); unknown values are ignored. A valid dock wins over a route. */
export function parseSelectionFromSearch(search: string): Selection | null {
  const params = new URLSearchParams(search);
  const dock = params.get(DOCK_PARAM)?.trim().toLowerCase();
  if (dock) {
    const station = ferryStations.find((candidate) => candidate.id.toLowerCase() === dock);
    if (station) return { kind: "station", id: station.id };
  }
  const code = params.get(ROUTE_PARAM)?.trim().toLowerCase();
  if (code) {
    const route = ferryRoutes.find((candidate) => candidate.code.toLowerCase() === code);
    if (route) return { kind: "route", id: route.id };
  }
  return null;
}

/** Returns `search` with the dock/route params replaced to match the selection; other params are kept. */
export function applySelectionToSearch(search: string, selection: Selection | null): string {
  const params = new URLSearchParams(search);
  params.delete(DOCK_PARAM);
  params.delete(ROUTE_PARAM);
  if (selection?.kind === "station") {
    const station = findStation(selection.id);
    if (station) params.set(DOCK_PARAM, station.id);
  } else if (selection?.kind === "route") {
    const route = findRoute(selection.id);
    if (route) params.set(ROUTE_PARAM, route.code);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Absolute link to a selection, for sharing. */
export function buildShareUrl(selection: Selection, location: Pick<Location, "origin" | "pathname">): string {
  return `${location.origin}${location.pathname}${applySelectionToSearch("", selection)}`;
}

/** Favourites are stored as "station:<id>" or "route:<id>". Anything unknown is dropped. */
export function serializeFavorite(selection: Selection): string {
  return `${selection.kind}:${selection.id}`;
}

export function parseFavorite(raw: string | null): Selection | null {
  if (!raw) return null;
  const separator = raw.indexOf(":");
  if (separator === -1) return null;
  const kind = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (kind === "station" && findStation(id)) return { kind: "station", id };
  if (kind === "route" && findRoute(id)) return { kind: "route", id };
  return null;
}
