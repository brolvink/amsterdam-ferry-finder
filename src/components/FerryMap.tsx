import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ferryRoutes,
  ferryDocks,
  getSimulatedPositions,
  type FerryPosition,
  type FerryRoute,
} from "@/data/ferries";

interface FerryMapProps {
  onSelectRoute: (route: FerryRoute | null) => void;
  selectedRouteId: string | null;
  isNight: boolean;
}

const AMSTERDAM_CENTER: [number, number] = [52.3885, 4.9013];
const AMSTERDAM_BOUNDS = L.latLngBounds(
  [52.30, 4.73], // Southwest edge of Amsterdam area
  [52.43, 5.05] // Northeast edge of Amsterdam area
);
const BASE_ZOOM_LEVEL = 14;
const BASE_ICON_WIDTH = 92;
const BASE_ICON_HEIGHT = 58;
const MIN_ICON_WIDTH = 50;
const MIN_ICON_HEIGHT = 32;
const FERRY_ICON_URL = `${import.meta.env.BASE_URL}ferry-indicator.png`;
const AZARTPLEIN_ICON_URL = `${import.meta.env.BASE_URL}azartplein-indicator.png`;
const SHORT_LINE_STOP_IDS = new Set(["azartplein", "zamenhof"]);
const DAY_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const NIGHT_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

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

function getFerryIconSizeForZoom(zoom: number): FerryIconSize {
  // Scale icons with zoom: bigger when zooming in, smaller when zooming out.
  const zoomDelta = zoom - BASE_ZOOM_LEVEL;
  const scale = Math.max(MIN_ICON_WIDTH / BASE_ICON_WIDTH, Math.pow(1.18, zoomDelta));
  const width = Math.max(MIN_ICON_WIDTH, Math.round(BASE_ICON_WIDTH * scale));
  const height = Math.max(MIN_ICON_HEIGHT, Math.round(BASE_ICON_HEIGHT * scale));

  return {
    width,
    height,
    anchorX: Math.round(width / 2),
    anchorY: Math.round(height / 2),
  };
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

function createDockIcon(dockId: string) {
  if (SHORT_LINE_STOP_IDS.has(dockId)) {
    return L.icon({
      iconUrl: AZARTPLEIN_ICON_URL,
      iconSize: [58, 58],
      iconAnchor: [29, 29],
      popupAnchor: [0, -29],
      tooltipAnchor: [0, -27],
      className: "dock-marker-img",
    });
  }

  return L.divIcon({
    className: "dock-marker",
    html: `<div style="
      width: 24px;
      height: 24px;
      background: hsl(38 68% 62%);
      border: 2.5px solid hsl(30 30% 30%);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
    "><span style="transform: rotate(45deg); font-size: 10px;">📍</span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

function createLandmarkIcon(image: string) {
  return L.icon({
    iconUrl: `${import.meta.env.BASE_URL}${image}`,
    iconSize: [72, 72],
    iconAnchor: [36, 72],
    popupAnchor: [0, -72],
    tooltipAnchor: [0, -72],
    className: "landmark-marker-img",
  });
}

export default function FerryMap({ onSelectRoute, selectedRouteId, isNight }: FerryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const ferryMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const [positions, setPositions] = useState<FerryPosition[]>([]);
  const [zoomLevel, setZoomLevel] = useState(BASE_ZOOM_LEVEL);
  const [ferryIconSize, setFerryIconSize] = useState<FerryIconSize>(() =>
    getFerryIconSizeForZoom(BASE_ZOOM_LEVEL)
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

    map.fitBounds(AMSTERDAM_BOUNDS);
    map.setMinZoom(map.getBoundsZoom(AMSTERDAM_BOUNDS, true));
    map.setMaxBounds(AMSTERDAM_BOUNDS);

    ferryDocks.forEach((dock) => {
      const marker = L.marker([dock.lat, dock.lng], { icon: createDockIcon(dock.id) }).addTo(map);
      marker.bindTooltip(dock.name, {
        direction: "top",
        offset: SHORT_LINE_STOP_IDS.has(dock.id) ? [0, -31] : [0, -26],
      });
    });

    LANDMARKS.forEach((landmark) => {
      const marker = L.marker([landmark.lat, landmark.lng], {
        icon: createLandmarkIcon(landmark.image),
      }).addTo(map);
      marker.bindTooltip(landmark.name, {
        direction: "top",
        offset: [0, -66],
      });
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
      setFerryIconSize(getFerryIconSizeForZoom(currentZoom));
      setZoomLevel(currentZoom);
    };
    syncIconSize();
    map.on("zoomend", syncIconSize);

    mapInstanceRef.current = map;

    return () => {
      map.off("zoomend", syncIconSize);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markerStore.clear();
    };
  }, [isNight, onSelectRoute]);

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

      if (existingMarker) {
        existingMarker.setLatLng([position.lat, position.lng]);
        existingMarker.setIcon(createFerryIcon(route.color, position.isDocked, ferryIconSize));
        existingMarker.setTooltipContent(tooltipContent);
        return;
      }

      const marker = L.marker([position.lat, position.lng], {
        icon: createFerryIcon(route.color, position.isDocked, ferryIconSize),
      }).addTo(map);

      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });

      marker.on("click", () => onSelectRoute(route));
      ferryMarkersRef.current.set(position.id, marker);
    });

    ferryMarkersRef.current.forEach((marker, markerId) => {
      if (activeIds.has(markerId)) return;
      marker.remove();
      ferryMarkersRef.current.delete(markerId);
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
    <div className="relative w-full h-full" style={{ minHeight: 600 }}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
