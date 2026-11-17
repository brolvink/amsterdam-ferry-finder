import { useCallback, useEffect, useState } from "react";
import type { FerryRoute, FerryStation } from "@/data/ferries";
import { getPreference, PREFERENCE_KEYS } from "@/lib/preferences";
import {
  applySelectionToSearch,
  parseFavorite,
  parseSelectionFromSearch,
  selectionEquals,
  type Selection,
} from "@/lib/selection";

function initialSelection(): Selection | null {
  // Priority: a link target, else the favourite, else nothing open.
  return (
    parseSelectionFromSearch(window.location.search) ?? parseFavorite(getPreference(PREFERENCE_KEYS.favorite))
  );
}

/**
 * Which card is open. Mirrors it into ?dock= / ?route= with replaceState (no history spam)
 * and follows popstate. All handlers are referentially stable.
 */
export function useSelection() {
  const [selection, setSelection] = useState<Selection | null>(initialSelection);

  const selectRoute = useCallback((route: FerryRoute | null) => {
    setSelection((previous) => {
      if (!route) return null;
      const next: Selection = { kind: "route", id: route.id };
      return selectionEquals(previous, next) ? null : next;
    });
  }, []);

  const selectStation = useCallback((station: FerryStation | null) => {
    setSelection((previous) => {
      if (!station) return null;
      const next: Selection = { kind: "station", id: station.id };
      return selectionEquals(previous, next) ? null : next;
    });
  }, []);

  /** Opens a station even if it is already open (used by "Near me"). */
  const openStation = useCallback((stationId: string) => {
    setSelection({ kind: "station", id: stationId });
  }, []);

  const close = useCallback(() => setSelection(null), []);

  useEffect(() => {
    const search = applySelectionToSearch(window.location.search, selection);
    if (search !== window.location.search) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
    }
  }, [selection]);

  useEffect(() => {
    const onPopState = () => setSelection(parseSelectionFromSearch(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return { selection, selectRoute, selectStation, openStation, close };
}
