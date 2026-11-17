import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./FerryMap.css";
import {
  ferryRoutes,
  ferryStations,
  getSimulatedPositions,
  type FerryPosition,
  type FerryRoute,
  type FerryStation,
} from "@/data/ferries";

interface FerryMapProps {
  onSelectRoute: (route: FerryRoute | null) => void;
  onSelectStation: (station: FerryStation | null) => void;
  selectedRouteId: string | null;
  selectedStationId: string | null;
  favoriteStationId: string | null;
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  isNight: boolean;
}

const AMSTERDAM_CENTER: [number, number] = [52.3885, 4.9013];
const AMSTERDAM_BOUNDS = L.latLngBounds(
  [52.366, 4.868], // Incrementally expanded southwest edge around city-centre ferry network
  [52.413, 4.955] // Incrementally expanded northeast edge around city-centre ferry network
);
const BASE_ZOOM_LEVEL = 14;
const BASE_ICON_WIDTH = 92;
const BASE_ICON_HEIGHT = 58;
const MIN_ICON_WIDTH = 50;
const MIN_ICON_HEIGHT = 32;
const BASE_DOCK_ICON_SIZE = 48;
const BASE_SHORT_LINE_STOP_ICON_SIZE = 52;
const BASE_LANDMARK_ICON_SIZE = 80;
const BASE_CENTRAL_EAST_ICON_SIZE = 72;
const MIN_DOCK_ICON_SIZE = 32;
const MIN_SHORT_LINE_STOP_ICON_SIZE = 36;
const MIN_LANDMARK_ICON_SIZE = 46;
const MIN_CENTRAL_EAST_ICON_SIZE = 42;
const FERRY_ICON_URL = `${import.meta.env.BASE_URL}ferry-indicator.png`;
const AZARTPLEIN_ICON_URL = `${import.meta.env.BASE_URL}azartplein-indicator.png`;
const CS_DOCK_ICON_URL = `${import.meta.env.BASE_URL}cs-indicator.png`;
const NACO_HUISJE_ICON_URL = `${import.meta.env.BASE_URL}naco-huisje.png`;
const SHORT_LINE_STOP_IDS = new Set(["azartplein", "zamenhof"]);
const CENTRAL_EAST_DOCK_ID = "cs-east";
// CARTO's free basemaps now answer every request with an "API KEY REQUIRED" tile, so the
// default is OpenStreetMap's own tiles. Set VITE_TILE_URL_DAY / VITE_TILE_URL_NIGHT (and
// VITE_TILE_ATTRIBUTION) at build time to use another provider, e.g. a keyed CARTO URL.
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DAY_TILE_URL = import.meta.env.VITE_TILE_URL_DAY || DEFAULT_TILE_URL;
const CUSTOM_NIGHT_TILE_URL: string | undefined = import.meta.env.VITE_TILE_URL_NIGHT || undefined;
const NIGHT_TILE_URL = CUSTOM_NIGHT_TILE_URL ?? DAY_TILE_URL;
// Without a dedicated dark tile set, night mode darkens the day tiles with a CSS filter.
const NIGHT_USES_FILTER = !CUSTOM_NIGHT_TILE_URL;
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION;
const ZOOM_SCALE_FACTOR = 1.35;
const MAX_ICON_SCALE = 3.25;

const COMPACT_BREAKPOINT = 768;
const MOBILE_MIN_WIDTH = 64;
const MOBILE_MIN_HEIGHT = 40;
const MOBILE_MIN_DOCK_SIZE = 44;

// Ferries move at a few m/s; even at the highest zoom that is under a pixel per 100 ms.
const FERRY_TICK_MS = 100;
const MAX_USER_ACCURACY_M = 300;
// Space reserved for the HUD / detail card when deciding what is "comfortably visible".
const VIEW_PAD_TOP = 72;
const VIEW_PAD_SIDE = 24;
const VIEW_PAD_BOTTOM_DESKTOP = 24;
const VIEW_PAD_RIGHT_DESKTOP = 352; // 320 px card plus gutter
const VIEW_PAD_BOTTOM_COMPACT_RATIO = 0.48; // card covers roughly the lower half on phones

const LANDMARKS = [
  {
    id: "ndsm-crane",
    name: "NDSM Crane",
    image: "ndsm-crane.png",
    lat: 52.40010053742091,
    lng: 4.895017373874423,
  },
  {
    id: "adam-tower",
    name: "A'DAM Tower",
    image: "adam-tower.png",
    lat: 52.384089140140595,
    lng: 4.90208418889229,
  },
  {
    id: "pontsteiger",
    name: "Pontsteiger",
    image: "pontsteiger.png",
    lat: 52.393262824659786,
    lng: 4.88603173431426,
  },
] as const;

interface FerryIconSize {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

interface MarkerIconSize {
  size: number;
  half: number;
}

function getFerryIconVisualKey(isDocked: boolean, dim: boolean, size: FerryIconSize): string {
  return `${isDocked ? "1" : "0"}|${dim ? "1" : "0"}|${size.width}x${size.height}`;
}

function getFerryIconSizeForZoom(zoom: number, baseZoom: number, compact: boolean): FerryIconSize {
  // Scale icons with zoom: bigger when zooming in, smaller when zooming out.
  const zoomDelta = zoom - baseZoom;
  const currentMinW = compact ? MOBILE_MIN_WIDTH : MIN_ICON_WIDTH;
  const currentMinH = compact ? MOBILE_MIN_HEIGHT : MIN_ICON_HEIGHT;

  const scale = Math.min(
    MAX_ICON_SCALE,
    Math.max(currentMinW / BASE_ICON_WIDTH, Math.pow(ZOOM_SCALE_FACTOR, zoomDelta))
  );
  const width = Math.max(currentMinW, Math.round(BASE_ICON_WIDTH * scale));
  const height = Math.max(currentMinH, Math.round(BASE_ICON_HEIGHT * scale));

  return {
    width,
    height,
    anchorX: Math.round(width / 2),
    anchorY: Math.round(height / 2),
  };
}

function getMarkerIconSizeForZoom(
  zoom: number,
  baseZoom: number,
  baseSize: number,
  minSize: number,
  compact: boolean
): MarkerIconSize {
  const zoomDelta = zoom - baseZoom;
  const currentMin = compact ? Math.max(minSize, MOBILE_MIN_DOCK_SIZE) : minSize;

  const scale = Math.min(
    MAX_ICON_SCALE,
    Math.max(currentMin / baseSize, Math.pow(ZOOM_SCALE_FACTOR, zoomDelta))
  );
  const size = Math.max(currentMin, Math.round(baseSize * scale));

  return {
    size,
    half: Math.round(size / 2),
  };
}

function getFerryTooltipOffset(size: FerryIconSize): [number, number] {
  return [0, -Math.round(size.height / 2 + 2)];
}

function getLandmarkTooltipOffset(size: number): [number, number] {
  return [0, -Math.round(size / 2 - 8)];
}

function createFerryIcon(color: string, isDocked: boolean, dim: boolean, size: FerryIconSize) {
  const movementClass = isDocked ? "ferry-marker__icon--docked" : "ferry-marker__icon--moving";

  return L.divIcon({
    className: dim ? "ferry-marker ferry-marker--dim" : "ferry-marker",
    html: `<div class="ferry-marker__icon ${movementClass}" style="
      width: ${size.width}px;
      height: ${size.height}px;
      min-width: ${MIN_ICON_WIDTH}px;
      min-height: ${MIN_ICON_HEIGHT}px;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    ">
      <img
        src="${FERRY_ICON_URL}"
        alt="Ferry"
        class="ferry-marker-img"
        style="
          width: ${size.width}px;
          height: ${size.height}px;
          min-width: ${MIN_ICON_WIDTH}px;
          min-height: ${MIN_ICON_HEIGHT}px;
          max-width: ${size.width}px;
          max-height: ${size.height}px;
          object-fit: contain;
          display: block;
        "
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <span style="
        display: none;
        font-size: 24px;
        color: ${color};
        align-items: center;
        justify-content: center;
      ">⛴️</span>
    </div>`,
    iconSize: [size.width, size.height],
    iconAnchor: [size.anchorX, size.anchorY],
  });
}

interface StationIconSpec {
  url: string;
  base: number;
  min: number;
  // The point where the artwork meets the ground, as a fraction of the image.
  anchor: [number, number];
}

/** The special icons are keyed by dock id; a station uses the icon of its first matching dock. */
function getStationIconSpec(station: FerryStation): StationIconSpec {
  if (station.dockIds.includes(CENTRAL_EAST_DOCK_ID)) {
    return { url: NACO_HUISJE_ICON_URL, base: BASE_CENTRAL_EAST_ICON_SIZE, min: MIN_CENTRAL_EAST_ICON_SIZE, anchor: [0.51, 0.58] };
  }
  if (station.dockIds.some((id) => SHORT_LINE_STOP_IDS.has(id))) {
    return { url: AZARTPLEIN_ICON_URL, base: BASE_SHORT_LINE_STOP_ICON_SIZE, min: MIN_SHORT_LINE_STOP_ICON_SIZE, anchor: [0.51, 0.9] };
  }
  return { url: CS_DOCK_ICON_URL, base: BASE_DOCK_ICON_SIZE, min: MIN_DOCK_ICON_SIZE, anchor: [0.64, 0.87] };
}

function getStationClassName(isSelected: boolean, isFavorite: boolean): string {
  return `station-marker${isSelected ? " station-marker--selected" : ""}${isFavorite ? " station-marker--favorite" : ""}`;
}

function createStationIcon(
  station: FerryStation,
  zoom: number,
  baseZoom: number,
  compact: boolean,
  isSelected: boolean,
  isFavorite: boolean
) {
  const spec = getStationIconSpec(station);
  const { size } = getMarkerIconSizeForZoom(zoom, baseZoom, spec.base, spec.min, compact);
  const anchorX = Math.round(size * spec.anchor[0]);
  const anchorY = Math.round(size * spec.anchor[1]);

  return L.divIcon({
    className: getStationClassName(isSelected, isFavorite),
    html: `<div class="station-marker__inner"><img class="station-marker__img" src="${spec.url}" alt="" draggable="false" /><span class="station-marker__star" aria-hidden="true">&#9733;</span></div>`,
    iconSize: [size, size],
    iconAnchor: [anchorX, anchorY],
    tooltipAnchor: [Math.round(size / 2) - anchorX, -anchorY - 4],
  });
}

function createLandmarkIcon(image: string, zoom: number, baseZoom: number, compact: boolean) {
  const { size } = getMarkerIconSizeForZoom(
    zoom,
    baseZoom,
    BASE_LANDMARK_ICON_SIZE,
    MIN_LANDMARK_ICON_SIZE,
    compact
  );

  return L.icon({
    iconUrl: `${import.meta.env.BASE_URL}${image}`,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), size],
    popupAnchor: [0, -Math.round(size * 0.75)],
    tooltipAnchor: [0, -Math.round(size * 0.75)],
    className: "landmark-marker-img",
  });
}

/** Builds the ferry tooltip from DOM nodes (no HTML string interpolation). */
function buildFerryTooltip(route: FerryRoute, position: FerryPosition): HTMLElement {
  const destination = position.direction === "outbound" ? route.docks[1].name : route.docks[0].name;
  const root = document.createElement("div");
  root.style.cssText = "font-family: 'Quicksand', sans-serif; font-size: 12px; font-weight: 600;";

  const code = document.createElement("strong");
  code.style.color = route.color;
  code.textContent = route.code;

  const line2 = position.isDocked ? `At dock: ${destination}` : `Sailing to ${destination}`;
  const line3 = `⏱ ${position.isDocked ? "At dock" : `Arrives in ${position.eta} min`} · ${position.speed.toFixed(1)} kn`;

  root.append(code, document.createElement("br"), line2, document.createElement("br"), line3);
  return root;
}

function getFerryTooltipKey(route: FerryRoute, position: FerryPosition): string {
  return `${route.id}|${position.direction}|${position.isDocked ? "d" : `s${position.eta}`}|${position.speed.toFixed(1)}`;
}

interface FerryMarkerEntry {
  marker: L.Marker;
  route: FerryRoute;
  isDocked: boolean;
  visualKey: string;
  tooltipKey: string;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function FerryMap({
  onSelectRoute,
  onSelectStation,
  selectedRouteId,
  selectedStationId,
  favoriteStationId,
  userLocation,
  isNight,
}: FerryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const usingFallbackTilesRef = useRef(false);
  const ferryMarkersRef = useRef<Map<string, FerryMarkerEntry>>(new Map());
  const stationMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const landmarkMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const userDotRef = useRef<L.CircleMarker | null>(null);
  const userAccuracyRef = useRef<L.Circle | null>(null);
  const iconScaleBaseZoomRef = useRef(BASE_ZOOM_LEVEL);
  const compactRef = useRef(false);
  const ferryIconSizeRef = useRef<FerryIconSize>(
    getFerryIconSizeForZoom(BASE_ZOOM_LEVEL, BASE_ZOOM_LEVEL, false)
  );
  const initialIsNightRef = useRef(isNight);
  const previousSelectionRef = useRef<{ stationId: string | null; routeId: string | null }>({
    stationId: null,
    routeId: null,
  });

  // Latest props, readable from long-lived Leaflet callbacks and the animation loop
  // without re-creating the map when a parent passes new callback identities.
  const onSelectRouteRef = useRef(onSelectRoute);
  const onSelectStationRef = useRef(onSelectStation);
  const selectedRouteIdRef = useRef(selectedRouteId);
  const selectedStationIdRef = useRef(selectedStationId);
  const favoriteStationIdRef = useRef(favoriteStationId);
  onSelectRouteRef.current = onSelectRoute;
  onSelectStationRef.current = onSelectStation;
  selectedRouteIdRef.current = selectedRouteId;
  selectedStationIdRef.current = selectedStationId;
  favoriteStationIdRef.current = favoriteStationId;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const ferryMarkers = ferryMarkersRef.current;
    const stationMarkers = stationMarkersRef.current;
    const landmarkMarkers = landmarkMarkersRef.current;
    const routeLines = routeLinesRef.current;
    let zoomSyncAnimationFrame: number | null = null;
    let relayoutAnimationFrame: number | null = null;
    let ferryAnimationFrame: number | null = null;
    let lastFerryTick = 0;
    const relayoutTimeouts: number[] = [];

    const map = L.map(mapRef.current, {
      center: AMSTERDAM_CENTER,
      zoom: BASE_ZOOM_LEVEL,
      zoomControl: false,
      attributionControl: true,
      maxBounds: AMSTERDAM_BOUNDS,
      maxBoundsViscosity: 1.0,
    });

    const tileLayer = L.tileLayer(initialIsNightRef.current ? NIGHT_TILE_URL : DAY_TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 18,
      // CORS-enabled requests keep the service worker's cached tiles non-opaque.
      crossOrigin: true,
    }).addTo(map);
    tileLayerRef.current = tileLayer;
    tileLayer.on("tileerror", () => {
      const activeUrl = map.getContainer().classList.contains("map-theme-night") ? NIGHT_TILE_URL : DAY_TILE_URL;
      if (usingFallbackTilesRef.current || activeUrl === DEFAULT_TILE_URL) return;
      usingFallbackTilesRef.current = true;
      map.attributionControl.removeAttribution(TILE_ATTRIBUTION);
      tileLayer.options.attribution = DEFAULT_TILE_ATTRIBUTION;
      map.attributionControl.addAttribution(DEFAULT_TILE_ATTRIBUTION);
      map.getContainer().classList.toggle("map-night-filter", map.getContainer().classList.contains("map-theme-night"));
      tileLayer.setUrl(DEFAULT_TILE_URL);
    });
    map.getContainer().classList.toggle("map-theme-night", initialIsNightRef.current);
    map.getContainer().classList.toggle("map-night-filter", initialIsNightRef.current && NIGHT_USES_FILTER);

    const updateCompact = () => {
      const compact = map.getContainer().clientWidth < COMPACT_BREAKPOINT;
      const changed = compact !== compactRef.current;
      compactRef.current = compact;
      return changed;
    };
    updateCompact();

    const enforceAmsterdamViewportLimit = () => {
      // Recalculate minimum zoom from the current viewport size so users
      // cannot zoom out to a view wider than Amsterdam.
      const minZoom = map.getBoundsZoom(AMSTERDAM_BOUNDS, true);
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) {
        map.setZoom(minZoom, { animate: false });
      }
      map.panInsideBounds(AMSTERDAM_BOUNDS, { animate: false });
    };

    const ferryDimmed = (route: FerryRoute) =>
      selectedRouteIdRef.current !== null && selectedRouteIdRef.current !== route.id;

    const stationIconFor = (station: FerryStation) =>
      createStationIcon(
        station,
        map.getZoom(),
        iconScaleBaseZoomRef.current,
        compactRef.current,
        selectedStationIdRef.current === station.id,
        favoriteStationIdRef.current === station.id
      );

    // Not animated: an animated fit finishes after the min-zoom check below and can leave
    // the map zoomed out past the Amsterdam limit until the next relayout.
    map.fitBounds(AMSTERDAM_BOUNDS, { animate: false });
    enforceAmsterdamViewportLimit();
    map.setMaxBounds(AMSTERDAM_BOUNDS);
    iconScaleBaseZoomRef.current = map.getZoom();
    ferryIconSizeRef.current = getFerryIconSizeForZoom(
      map.getZoom(),
      iconScaleBaseZoomRef.current,
      compactRef.current
    );

    ferryStations.forEach((station) => {
      const marker = L.marker([station.lat, station.lng], { icon: stationIconFor(station) }).addTo(map);
      marker.bindTooltip(station.name, { direction: "top" });
      marker.on("click", () => onSelectStationRef.current(station));
      stationMarkers.set(station.id, marker);
    });

    LANDMARKS.forEach((landmark) => {
      const marker = L.marker([landmark.lat, landmark.lng], {
        icon: createLandmarkIcon(
          landmark.image,
          map.getZoom(),
          iconScaleBaseZoomRef.current,
          compactRef.current
        ),
      }).addTo(map);
      const landmarkIconSize = getMarkerIconSizeForZoom(
        map.getZoom(),
        iconScaleBaseZoomRef.current,
        BASE_LANDMARK_ICON_SIZE,
        MIN_LANDMARK_ICON_SIZE,
        compactRef.current
      );
      marker.bindTooltip(landmark.name, {
        direction: "top",
        offset: getLandmarkTooltipOffset(landmarkIconSize.size),
      });
      landmarkMarkers.set(landmark.id, marker);
    });

    ferryRoutes.forEach((route) => {
      const selected = selectedRouteIdRef.current === route.id;
      const line = L.polyline(
        route.path.map((point) => [point.lat, point.lng] as [number, number]),
        {
          color: route.color,
          weight: selected ? 7 : 5,
          opacity: selected ? 0.72 : 0.3,
          dashArray: selected ? undefined : "6 10",
          lineCap: "round",
        }
      ).addTo(map);

      line.on("click", () => {
        onSelectRouteRef.current(route);
      });

      routeLines.set(route.id, line);
    });

    // Re-creates a ferry's icon only when its visual key (state, dimming, size) changed.
    const refreshFerryIcon = (entry: FerryMarkerEntry) => {
      const size = ferryIconSizeRef.current;
      const dim = ferryDimmed(entry.route);
      const key = getFerryIconVisualKey(entry.isDocked, dim, size);
      if (key === entry.visualKey) return;
      entry.visualKey = key;
      entry.marker.setIcon(createFerryIcon(entry.route.color, entry.isDocked, dim, size));
      const tooltip = entry.marker.getTooltip();
      if (tooltip) tooltip.options.offset = getFerryTooltipOffset(size);
    };

    const syncIconSize = () => {
      const currentZoom = map.getZoom();
      const baseZoom = iconScaleBaseZoomRef.current;
      const compact = compactRef.current;
      ferryIconSizeRef.current = getFerryIconSizeForZoom(currentZoom, baseZoom, compact);

      ferryMarkers.forEach(refreshFerryIcon);

      ferryStations.forEach((station) => {
        stationMarkers.get(station.id)?.setIcon(stationIconFor(station));
      });

      const landmarkIconSize = getMarkerIconSizeForZoom(
        currentZoom,
        baseZoom,
        BASE_LANDMARK_ICON_SIZE,
        MIN_LANDMARK_ICON_SIZE,
        compact
      );
      LANDMARKS.forEach((landmark) => {
        const marker = landmarkMarkers.get(landmark.id);
        if (!marker) return;
        marker.setIcon(createLandmarkIcon(landmark.image, currentZoom, baseZoom, compact));
        const tooltip = marker.getTooltip();
        if (tooltip) tooltip.options.offset = getLandmarkTooltipOffset(landmarkIconSize.size);
      });
    };
    const syncIconSizeOnAnimationFrame = () => {
      if (zoomSyncAnimationFrame !== null) return;
      zoomSyncAnimationFrame = window.requestAnimationFrame(() => {
        zoomSyncAnimationFrame = null;
        syncIconSize();
      });
    };
    syncIconSize();

    // Imperative ferry loop: no React state. rAF is throttled to FERRY_TICK_MS and the
    // browser pauses rAF in hidden tabs; visibilitychange makes that explicit and catches up on return.
    const updateFerries = () => {
      const positions = getSimulatedPositions();
      const activeIds = new Set<string>();

      for (const position of positions) {
        const route = ferryRoutes.find((candidate) => candidate.id === position.routeId);
        if (!route) continue;
        activeIds.add(position.id);

        const entry = ferryMarkers.get(position.id);
        const tooltipKey = getFerryTooltipKey(route, position);

        if (entry) {
          entry.marker.setLatLng([position.lat, position.lng]);
          if (entry.isDocked !== position.isDocked) {
            entry.isDocked = position.isDocked;
            refreshFerryIcon(entry);
          }
          if (entry.tooltipKey !== tooltipKey) {
            entry.tooltipKey = tooltipKey;
            entry.marker.setTooltipContent(buildFerryTooltip(route, position));
          }
          continue;
        }

        const size = ferryIconSizeRef.current;
        const dim = ferryDimmed(route);
        const marker = L.marker([position.lat, position.lng], {
          icon: createFerryIcon(route.color, position.isDocked, dim, size),
        }).addTo(map);
        marker.bindTooltip(buildFerryTooltip(route, position), {
          direction: "top",
          offset: getFerryTooltipOffset(size),
          opacity: 0.95,
        });
        marker.on("click", () => onSelectRouteRef.current(route));
        ferryMarkers.set(position.id, {
          marker,
          route,
          isDocked: position.isDocked,
          visualKey: getFerryIconVisualKey(position.isDocked, dim, size),
          tooltipKey,
        });
      }

      ferryMarkers.forEach((entry, id) => {
        if (activeIds.has(id)) return;
        entry.marker.remove();
        ferryMarkers.delete(id);
      });
    };
    const ferryFrame = (time: number) => {
      ferryAnimationFrame = window.requestAnimationFrame(ferryFrame);
      if (time - lastFerryTick < FERRY_TICK_MS) return;
      lastFerryTick = time;
      updateFerries();
    };
    const startFerryLoop = () => {
      if (ferryAnimationFrame !== null || document.hidden) return;
      lastFerryTick = 0;
      ferryAnimationFrame = window.requestAnimationFrame(ferryFrame);
    };
    const stopFerryLoop = () => {
      if (ferryAnimationFrame === null) return;
      window.cancelAnimationFrame(ferryAnimationFrame);
      ferryAnimationFrame = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopFerryLoop();
      } else {
        updateFerries();
        startFerryLoop();
      }
    };
    updateFerries();
    startFerryLoop();
    document.addEventListener("visibilitychange", onVisibilityChange);

    const handleResize = () => {
      if (updateCompact()) syncIconSize();
      enforceAmsterdamViewportLimit();
    };
    const scheduleMapRelayout = () => {
      if (relayoutAnimationFrame !== null) return;

      relayoutAnimationFrame = window.requestAnimationFrame(() => {
        relayoutAnimationFrame = null;
        if (!mapInstanceRef.current) return;

        map.invalidateSize({ pan: false, animate: false });
        handleResize();
      });
    };

    map.on("zoom", syncIconSizeOnAnimationFrame);
    map.on("zoomend", syncIconSize);
    map.on("resize", handleResize);
    map.whenReady(scheduleMapRelayout);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleMapRelayout();
          })
        : null;
    resizeObserver?.observe(map.getContainer());

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", scheduleMapRelayout);
    visualViewport?.addEventListener("scroll", scheduleMapRelayout);
    window.addEventListener("orientationchange", scheduleMapRelayout);
    window.addEventListener("pageshow", scheduleMapRelayout);

    relayoutTimeouts.push(window.setTimeout(scheduleMapRelayout, 0));
    relayoutTimeouts.push(window.setTimeout(scheduleMapRelayout, 250));
    relayoutTimeouts.push(window.setTimeout(scheduleMapRelayout, 1000));

    mapInstanceRef.current = map;

    return () => {
      map.off("zoom", syncIconSizeOnAnimationFrame);
      map.off("zoomend", syncIconSize);
      map.off("resize", handleResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopFerryLoop();
      resizeObserver?.disconnect();
      visualViewport?.removeEventListener("resize", scheduleMapRelayout);
      visualViewport?.removeEventListener("scroll", scheduleMapRelayout);
      window.removeEventListener("orientationchange", scheduleMapRelayout);
      window.removeEventListener("pageshow", scheduleMapRelayout);
      relayoutTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if (zoomSyncAnimationFrame !== null) {
        window.cancelAnimationFrame(zoomSyncAnimationFrame);
      }
      if (relayoutAnimationFrame !== null) {
        window.cancelAnimationFrame(relayoutAnimationFrame);
      }
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      userDotRef.current = null;
      userAccuracyRef.current = null;
      ferryMarkers.clear();
      stationMarkers.clear();
      landmarkMarkers.clear();
      routeLines.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const tileLayer = tileLayerRef.current;
    if (!map || !tileLayer) return;

    tileLayer.setUrl(usingFallbackTilesRef.current ? DEFAULT_TILE_URL : isNight ? NIGHT_TILE_URL : DAY_TILE_URL);
    map.getContainer().classList.toggle("map-theme-night", isNight);
    map.getContainer().classList.toggle("map-night-filter", isNight && (usingFallbackTilesRef.current || NIGHT_USES_FILTER));
    map.invalidateSize({ pan: false, animate: false });
  }, [isNight]);

  // Selected / favourite classes: toggled on the live elements. Icons are created from the
  // same refs, so the classes also survive the setIcon calls that happen on zoom.
  useEffect(() => {
    stationMarkersRef.current.forEach((marker, stationId) => {
      const el = marker.getElement();
      if (!el) return;
      el.classList.toggle("station-marker--selected", stationId === selectedStationId);
      el.classList.toggle("station-marker--favorite", stationId === favoriteStationId);
    });
  }, [selectedStationId, favoriteStationId]);

  // Route highlight and dimming of other routes' ferries.
  useEffect(() => {
    routeLinesRef.current.forEach((line, routeId) => {
      if (selectedRouteId === routeId) {
        line.setStyle({ weight: 7, opacity: 0.72, dashArray: undefined });
      } else {
        line.setStyle({ weight: 5, opacity: 0.3, dashArray: "6 10" });
      }
    });
    ferryMarkersRef.current.forEach((entry) => {
      entry.marker.getElement()?.classList.toggle(
        "ferry-marker--dim",
        selectedRouteId !== null && selectedRouteId !== entry.route.id
      );
    });
  }, [selectedRouteId]);

  // User location dot plus accuracy circle, updated in place.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!userLocation) {
      userDotRef.current?.remove();
      userAccuracyRef.current?.remove();
      userDotRef.current = null;
      userAccuracyRef.current = null;
      return;
    }

    const latlng: [number, number] = [userLocation.lat, userLocation.lng];
    const radius = Math.min(Math.max(userLocation.accuracy, 0), MAX_USER_ACCURACY_M);

    if (!userAccuracyRef.current) {
      userAccuracyRef.current = L.circle(latlng, {
        radius,
        stroke: true,
        weight: 1,
        color: "#2f7de1",
        opacity: 0.5,
        fillColor: "#2f7de1",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map);
    } else {
      userAccuracyRef.current.setLatLng(latlng).setRadius(radius);
    }

    if (!userDotRef.current) {
      userDotRef.current = L.circleMarker(latlng, {
        radius: 8,
        weight: 3,
        color: "#ffffff",
        opacity: 1,
        fillColor: "#2f7de1",
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
    } else {
      userDotRef.current.setLatLng(latlng);
    }
  }, [userLocation]);

  // Follow selection: pan (never zoom) so the target sits in the part of the map not covered
  // by the HUD or the detail card. Does nothing on clear, or if the target is already in view.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Only react to a selection that changed to a non-null value, not to a clear.
    const previous = previousSelectionRef.current;
    previousSelectionRef.current = { stationId: selectedStationId, routeId: selectedRouteId };
    const stationChanged = selectedStationId !== null && selectedStationId !== previous.stationId;
    const routeChanged = selectedRouteId !== null && selectedRouteId !== previous.routeId;
    if (!stationChanged && !routeChanged) return;

    let points: L.LatLng[] | null = null;
    if (stationChanged) {
      const station = ferryStations.find((candidate) => candidate.id === selectedStationId);
      if (station) points = [L.latLng(station.lat, station.lng)];
    } else {
      const route = ferryRoutes.find((candidate) => candidate.id === selectedRouteId);
      if (route) points = route.path.map((point) => L.latLng(point.lat, point.lng));
    }
    if (!points) return;
    const targetPoints = points;

    const follow = () => {
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const compact = size.x < COMPACT_BREAKPOINT;
      const left = VIEW_PAD_SIDE;
      const top = VIEW_PAD_TOP;
      const right = size.x - (compact ? VIEW_PAD_SIDE : VIEW_PAD_RIGHT_DESKTOP);
      const bottom = size.y - (compact ? size.y * VIEW_PAD_BOTTOM_COMPACT_RATIO : VIEW_PAD_BOTTOM_DESKTOP);
      if (right <= left || bottom <= top) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const latlng of targetPoints) {
        const pt = map.latLngToContainerPoint(latlng);
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
      if (minX >= left && maxX <= right && minY >= top && maxY <= bottom) return;

      // Move the target's centre to the centre of the free area.
      const delta = L.point(
        (minX + maxX) / 2 - (left + right) / 2,
        (minY + maxY) / 2 - (top + bottom) / 2
      );
      map.panBy(delta, { animate: !prefersReducedMotion(), duration: 0.6 });
    };

    follow();
  }, [selectedStationId, selectedRouteId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
