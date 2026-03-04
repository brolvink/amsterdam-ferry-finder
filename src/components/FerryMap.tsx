import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ferryRoutes,
  ferryDocks,
  getSimulatedPositions,
  type FerryPosition,
  type FerryDock,
  type FerryRoute,
} from "@/data/ferries";

interface FerryMapProps {
  onSelectRoute: (route: FerryRoute | null) => void;
  onSelectDock: (dock: FerryDock | null) => void;
  selectedRouteId: string | null;
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
const DAY_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const NIGHT_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ZOOM_SCALE_FACTOR = 1.35;
const MAX_ICON_SCALE = 3.25;

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const MOBILE_MIN_WIDTH = 64;
const MOBILE_MIN_HEIGHT = 40;
const MOBILE_MIN_DOCK_SIZE = 44;

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

function getFerryIconVisualKey(color: string, isDocked: boolean, size: FerryIconSize): string {
  return `${color}|${isDocked ? "1" : "0"}|${size.width}x${size.height}`;
}

function getFerryIconSizeForZoom(zoom: number, baseZoom: number): FerryIconSize {
  // Scale icons with zoom: bigger when zooming in, smaller when zooming out.
  const zoomDelta = zoom - baseZoom;
  const currentMinW = isMobile ? MOBILE_MIN_WIDTH : MIN_ICON_WIDTH;
  const currentMinH = isMobile ? MOBILE_MIN_HEIGHT : MIN_ICON_HEIGHT;

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
  minSize: number
): MarkerIconSize {
  const zoomDelta = zoom - baseZoom;
  const currentMin = isMobile ? Math.max(minSize, MOBILE_MIN_DOCK_SIZE) : minSize;

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

function getDockTooltipOffset(size: number): [number, number] {
  return [0, 0];
}

function getLandmarkTooltipOffset(size: number): [number, number] {
  return [0, -Math.round(size / 2 - 8)];
}

function createFerryIcon(color: string, isDocked: boolean, size: FerryIconSize) {
  const movementClass = isDocked ? "ferry-marker__icon--docked" : "ferry-marker__icon--moving";

  return L.divIcon({
    className: "ferry-marker",
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

function createDockIcon(dockId: string, zoom: number, baseZoom: number) {
  if (dockId === CENTRAL_EAST_DOCK_ID) {
    const { size, half } = getMarkerIconSizeForZoom(
      zoom,
      baseZoom,
      BASE_CENTRAL_EAST_ICON_SIZE,
      MIN_CENTRAL_EAST_ICON_SIZE
    );

    return L.icon({
      iconUrl: NACO_HUISJE_ICON_URL,
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -Math.round(half + 10)],
      tooltipAnchor: [0, -Math.round(half + 4)],
      className: "dock-marker-img",
    });
  }

  if (SHORT_LINE_STOP_IDS.has(dockId)) {
    const { size, half } = getMarkerIconSizeForZoom(
      zoom,
      baseZoom,
      BASE_SHORT_LINE_STOP_ICON_SIZE,
      MIN_SHORT_LINE_STOP_ICON_SIZE
    );

    return L.icon({
      iconUrl: AZARTPLEIN_ICON_URL,
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -Math.round(half + 10)],
      tooltipAnchor: [0, -Math.round(half + 4)],
      className: "dock-marker-img",
    });
  }

  const { size, half } = getMarkerIconSizeForZoom(
    zoom,
    baseZoom,
    BASE_DOCK_ICON_SIZE,
    MIN_DOCK_ICON_SIZE
  );

  return L.icon({
    iconUrl: CS_DOCK_ICON_URL,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -Math.round(half + 10)],
    tooltipAnchor: [0, -Math.round(half + 4)],
    className: "dock-marker-img",
  });
}

function getDockMarkerSize(
  dockId: string,
  zoom: number,
  baseZoom: number
): number {
  if (dockId === CENTRAL_EAST_DOCK_ID) {
    return getMarkerIconSizeForZoom(
      zoom,
      baseZoom,
      BASE_CENTRAL_EAST_ICON_SIZE,
      MIN_CENTRAL_EAST_ICON_SIZE
    ).size;
  }

  if (SHORT_LINE_STOP_IDS.has(dockId)) {
    return getMarkerIconSizeForZoom(
      zoom,
      baseZoom,
      BASE_SHORT_LINE_STOP_ICON_SIZE,
      MIN_SHORT_LINE_STOP_ICON_SIZE
    ).size;
  }

  return getMarkerIconSizeForZoom(
    zoom,
    baseZoom,
    BASE_DOCK_ICON_SIZE,
    MIN_DOCK_ICON_SIZE
  ).size;
}

function createLandmarkIcon(image: string, zoom: number, baseZoom: number) {
  const { size } = getMarkerIconSizeForZoom(
    zoom,
    baseZoom,
    BASE_LANDMARK_ICON_SIZE,
    MIN_LANDMARK_ICON_SIZE
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

export default function FerryMap({ onSelectRoute, onSelectDock, selectedRouteId, isNight }: FerryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const ferryMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const ferryMarkerVisualKeysRef = useRef<Map<string, string>>(new Map());
  const dockMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const landmarkMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const iconScaleBaseZoomRef = useRef(BASE_ZOOM_LEVEL);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const [positions, setPositions] = useState<FerryPosition[]>([]);
  const [ferryIconSize, setFerryIconSize] = useState<FerryIconSize>(() =>
    getFerryIconSizeForZoom(BASE_ZOOM_LEVEL, BASE_ZOOM_LEVEL)
  );

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const markerStore = ferryMarkersRef.current;

    const map = L.map(mapRef.current, {
      center: AMSTERDAM_CENTER,
      zoom: BASE_ZOOM_LEVEL,
      zoomControl: false,
      attributionControl: true,
      maxBounds: AMSTERDAM_BOUNDS,
      maxBoundsViscosity: 1.0,
    });

    const tileLayer = L.tileLayer(isNight ? NIGHT_TILE_URL : DAY_TILE_URL, {
      attribution:
        '&copy; <a href="https://osm.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);
    tileLayerRef.current = tileLayer;
    map.getContainer().classList.toggle("map-theme-night", isNight);

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

    map.fitBounds(AMSTERDAM_BOUNDS);
    enforceAmsterdamViewportLimit();
    map.setMaxBounds(AMSTERDAM_BOUNDS);
    iconScaleBaseZoomRef.current = map.getZoom();

    ferryDocks.forEach((dock) => {
      const marker = L.marker([dock.lat, dock.lng], {
        icon: createDockIcon(dock.id, map.getZoom(), iconScaleBaseZoomRef.current),
      }).addTo(map);
      const currentSize = getDockMarkerSize(
        dock.id,
        map.getZoom(),
        iconScaleBaseZoomRef.current
      );

      marker.bindTooltip(dock.name, {
        direction: "top",
        offset: getDockTooltipOffset(currentSize),
      });
      marker.on("click", () => onSelectDock(dock));
      dockMarkersRef.current.set(dock.id, marker);
    });

    LANDMARKS.forEach((landmark) => {
      const marker = L.marker([landmark.lat, landmark.lng], {
        icon: createLandmarkIcon(landmark.image, map.getZoom(), iconScaleBaseZoomRef.current),
      }).addTo(map);
      const landmarkIconSize = getMarkerIconSizeForZoom(map.getZoom(), iconScaleBaseZoomRef.current, BASE_LANDMARK_ICON_SIZE, MIN_LANDMARK_ICON_SIZE);
      marker.bindTooltip(landmark.name, {
        direction: "top",
        offset: getLandmarkTooltipOffset(landmarkIconSize.size),
      });
      landmarkMarkersRef.current.set(landmark.id, marker);
    });

    ferryRoutes.forEach((route) => {
      const line = L.polyline(
        route.path.map((point) => [point.lat, point.lng] as [number, number]),
        {
          color: route.color,
          weight: 5,
          opacity: 0.3,
          dashArray: "6 10",
          lineCap: "round",
        }
      ).addTo(map);

      line.on("click", () => {
        onSelectRoute(route);
      });

      routeLinesRef.current.push(line);
    });

    const syncIconSize = () => {
      const currentZoom = map.getZoom();
      setFerryIconSize(getFerryIconSizeForZoom(currentZoom, iconScaleBaseZoomRef.current));

      ferryDocks.forEach((dock) => {
        const marker = dockMarkersRef.current.get(dock.id);
        if (marker) {
          const currentSize = getDockMarkerSize(
            dock.id,
            currentZoom,
            iconScaleBaseZoomRef.current
          );

          marker.setIcon(createDockIcon(dock.id, currentZoom, iconScaleBaseZoomRef.current));
          const tooltip = marker.getTooltip();
          if (tooltip) {
            tooltip.options.offset = getDockTooltipOffset(currentSize);
          }
        }
      });

      LANDMARKS.forEach((landmark) => {
        const marker = landmarkMarkersRef.current.get(landmark.id);
        if (marker) {
          const landmarkIconSize = getMarkerIconSizeForZoom(currentZoom, iconScaleBaseZoomRef.current, BASE_LANDMARK_ICON_SIZE, MIN_LANDMARK_ICON_SIZE);
          marker.setIcon(createLandmarkIcon(landmark.image, currentZoom, iconScaleBaseZoomRef.current));
          const tooltip = marker.getTooltip();
          if (tooltip) {
            tooltip.options.offset = getLandmarkTooltipOffset(landmarkIconSize.size);
          }
        }
      });
    };
    let zoomSyncAnimationFrame: number | null = null;
    const syncIconSizeOnAnimationFrame = () => {
      if (zoomSyncAnimationFrame !== null) return;
      zoomSyncAnimationFrame = window.requestAnimationFrame(() => {
        zoomSyncAnimationFrame = null;
        syncIconSize();
      });
    };
    syncIconSize();
    map.on("zoom", syncIconSizeOnAnimationFrame);
    map.on("zoomend", syncIconSize);
    map.on("resize", enforceAmsterdamViewportLimit);

    mapInstanceRef.current = map;

    return () => {
      map.off("zoom", syncIconSizeOnAnimationFrame);
      map.off("zoomend", syncIconSize);
      map.off("resize", enforceAmsterdamViewportLimit);
      if (zoomSyncAnimationFrame !== null) {
        window.cancelAnimationFrame(zoomSyncAnimationFrame);
      }
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markerStore.clear();
      ferryMarkerVisualKeysRef.current.clear();
      dockMarkersRef.current.clear();
      landmarkMarkersRef.current.clear();
    };
  }, [onSelectDock, onSelectRoute]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const tileLayer = tileLayerRef.current;
    if (!map || !tileLayer) return;

    tileLayer.setUrl(isNight ? NIGHT_TILE_URL : DAY_TILE_URL);
    map.getContainer().classList.toggle("map-theme-night", isNight);
  }, [isNight]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPositions(getSimulatedPositions());
    }, 100);

    setPositions(getSimulatedPositions());

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activeIds = new Set<string>();

    positions.forEach((position) => {
      const route = ferryRoutes.find((candidate) => candidate.id === position.routeId);
      if (!route) return;

      activeIds.add(position.id);
      const existingMarker = ferryMarkersRef.current.get(position.id);
      const tooltipDirection = position.direction === "outbound" ? route.docks[1].name : route.docks[0].name;

      const tooltipContent = `<div style="font-family: 'Quicksand', sans-serif; font-size: 12px; font-weight: 600;">
        <strong style="color: ${route.color}">${route.code}</strong><br/>
        ${position.isDocked ? `At dock: ${position.direction === "outbound" ? route.docks[1].name : route.docks[0].name}` : `Sailing to ${tooltipDirection}`}<br/>
        ⏱ ${position.isDocked ? "At dock" : `Arrives in ${position.eta} min`} · ${position.speed.toFixed(1)} kn
      </div>`;
      const nextVisualKey = getFerryIconVisualKey(route.color, position.isDocked, ferryIconSize);

      if (existingMarker) {
        existingMarker.setLatLng([position.lat, position.lng]);
        const currentVisualKey = ferryMarkerVisualKeysRef.current.get(position.id);
        if (currentVisualKey !== nextVisualKey) {
          existingMarker.setIcon(createFerryIcon(route.color, position.isDocked, ferryIconSize));
          const tooltip = existingMarker.getTooltip();
          if (tooltip) {
            tooltip.options.offset = getFerryTooltipOffset(ferryIconSize);
          }
          ferryMarkerVisualKeysRef.current.set(position.id, nextVisualKey);
        }
        existingMarker.setTooltipContent(tooltipContent);
        return;
      }

      const marker = L.marker([position.lat, position.lng], {
        icon: createFerryIcon(route.color, position.isDocked, ferryIconSize),
      }).addTo(map);

      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: getFerryTooltipOffset(ferryIconSize),
        opacity: 0.95,
      });

      marker.on("click", () => onSelectRoute(route));
      ferryMarkersRef.current.set(position.id, marker);
      ferryMarkerVisualKeysRef.current.set(position.id, nextVisualKey);
    });

    ferryMarkersRef.current.forEach((marker, markerId) => {
      if (activeIds.has(markerId)) return;
      marker.remove();
      ferryMarkersRef.current.delete(markerId);
      ferryMarkerVisualKeysRef.current.delete(markerId);
    });
  }, [ferryIconSize, onSelectRoute, positions]);

  useEffect(() => {
    routeLinesRef.current.forEach((line, index) => {
      const route = ferryRoutes[index];
      if (route && selectedRouteId === route.id) {
        line.setStyle({ weight: 7, opacity: 0.72, dashArray: undefined });
      } else {
        line.setStyle({ weight: 5, opacity: 0.3, dashArray: "6 10" });
      }
    });
  }, [selectedRouteId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
