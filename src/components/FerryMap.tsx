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
      width: 18px; height: 18px;
      background: ${color};
      border: 2px solid ${color};
      border-radius: 50%;
      box-shadow: 0 0 12px ${color}88, 0 0 24px ${color}44;
      position: relative;
    ">
      <div style="
        position: absolute; inset: 3px;
        background: ${color};
        border-radius: 50%;
        animation: pulse-glow 2s ease-in-out infinite;
      "></div>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function createDockIcon() {
  return L.divIcon({
    className: "dock-marker",
    html: `<div style="
      width: 10px; height: 10px;
      background: hsl(190 100% 50%);
      border: 1px solid hsl(190 100% 70%);
      border-radius: 2px;
      box-shadow: 0 0 8px hsl(190 100% 50% / 0.6);
      transform: rotate(45deg);
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OSM</a>',
      maxZoom: 18,
    }).addTo(map);

    // Add dock markers
    ferryDocks.forEach((dock) => {
      const marker = L.marker([dock.lat, dock.lng], { icon: createDockIcon() }).addTo(map);
      marker.bindTooltip(dock.name, {
        className: "dock-tooltip",
        direction: "top",
        offset: [0, -8],
      });
    });

    // Add route lines
    ferryRoutes.forEach((route) => {
      const line = L.polyline(
        [
          [route.docks[0].lat, route.docks[0].lng],
          [route.docks[1].lat, route.docks[1].lng],
        ],
        {
          color: route.color,
          weight: 1.5,
          opacity: 0.3,
          dashArray: "6 8",
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

    // Remove old markers
    ferryMarkersRef.current.forEach((m) => m.remove());
    ferryMarkersRef.current = [];

    positions.forEach((pos, i) => {
      const route = ferryRoutes.find((r) => r.id === pos.routeId);
      if (!route) return;

      const marker = L.marker([pos.lat, pos.lng], {
        icon: createFerryIcon(route.color),
      }).addTo(map);

      const dir = pos.direction === "outbound" ? route.docks[1].name : route.docks[0].name;
      marker.bindTooltip(
        `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; background: hsl(220 20% 9%); color: hsl(150 100% 75%); padding: 6px 10px; border: 1px solid ${route.color}; border-radius: 2px;">
          <strong style="color: ${route.color}">${route.code}</strong><br/>
          → ${dir}<br/>
          ETA: ${pos.eta} min | ${pos.speed.toFixed(1)} kn
        </div>`,
        { className: "ferry-tooltip", direction: "top", offset: [0, -14], opacity: 0.95 }
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
        line.setStyle({ weight: 3, opacity: 0.8, dashArray: undefined });
      } else {
        line.setStyle({ weight: 1.5, opacity: 0.3, dashArray: "6 8" });
      }
    });
  }, [selectedRouteId]);

  return (
    <div ref={mapRef} className="w-full h-full" style={{ minHeight: 300 }} />
  );
}
