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
}

const AMSTERDAM_CENTER: [number, number] = [52.3885, 4.9013];

function createFerryIcon(color: string) {
  return L.divIcon({
    className: "ferry-marker",
    html: `<div style="
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      animation: bob 3s ease-in-out infinite;
    ">⛴️</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createDockIcon(name: string) {
  return L.divIcon({
    className: "dock-marker",
    html: `<div style="
      width: 24px; height: 24px;
      background: hsl(35 60% 55%);
      border: 2.5px solid hsl(30 30% 30%);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      display: flex; align-items: center; justify-content: center;
    "><span style="transform: rotate(45deg); font-size: 10px;">📍</span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

export default function FerryMap({ onSelectRoute, selectedRouteId }: FerryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const ferryMarkersRef = useRef<L.Marker[]>([]);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const [positions, setPositions] = useState<FerryPosition[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: AMSTERDAM_CENTER,
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });

    // Use CartoDB Voyager for a warm, friendly map style
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    // Add dock markers
    ferryDocks.forEach((dock) => {
      const marker = L.marker([dock.lat, dock.lng], { icon: createDockIcon(dock.name) }).addTo(map);
      marker.bindTooltip(dock.name, {
        direction: "top",
        offset: [0, -26],
      });
    });

    // Add route lines — thick, colorful, friendly
    ferryRoutes.forEach((route) => {
      const line = L.polyline(
        [
          [route.docks[0].lat, route.docks[0].lng],
          [route.docks[1].lat, route.docks[1].lng],
        ],
        {
          color: route.color,
          weight: 4,
          opacity: 0.35,
          dashArray: "8 12",
          lineCap: "round",
        }
      ).addTo(map);

      line.on("click", () => {
        onSelectRoute(route);
      });

      routeLinesRef.current.push(line);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update ferry positions
  useEffect(() => {
    const interval = setInterval(() => {
      setPositions(getSimulatedPositions());
    }, 1000);
    setPositions(getSimulatedPositions());
    return () => clearInterval(interval);
  }, []);

  // Render ferry markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    ferryMarkersRef.current.forEach((m) => m.remove());
    ferryMarkersRef.current = [];

    positions.forEach((pos) => {
      const route = ferryRoutes.find((r) => r.id === pos.routeId);
      if (!route) return;

      const marker = L.marker([pos.lat, pos.lng], {
        icon: createFerryIcon(route.color),
      }).addTo(map);

      const dir = pos.direction === "outbound" ? route.docks[1].name : route.docks[0].name;
      marker.bindTooltip(
        `<div style="font-family: 'Quicksand', sans-serif; font-size: 12px; font-weight: 600;">
          <strong style="color: ${route.color}">${route.code}</strong><br/>
          → ${dir}<br/>
          ⏱ ${pos.eta} min · ${pos.speed.toFixed(1)} kn
        </div>`,
        { direction: "top", offset: [0, -20], opacity: 0.95 }
      );

      marker.on("click", () => onSelectRoute(route));
      ferryMarkersRef.current.push(marker);
    });
  }, [positions, onSelectRoute]);

  // Highlight selected route
  useEffect(() => {
    routeLinesRef.current.forEach((line, i) => {
      const route = ferryRoutes[i];
      if (route && selectedRouteId === route.id) {
        line.setStyle({ weight: 6, opacity: 0.7, dashArray: undefined });
      } else {
        line.setStyle({ weight: 4, opacity: 0.35, dashArray: "8 12" });
      }
    });
  }, [selectedRouteId]);

  return (
    <div ref={mapRef} className="w-full h-full" style={{ minHeight: 300 }} />
  );
}
