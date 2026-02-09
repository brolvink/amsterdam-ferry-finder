import { useEffect, useState } from "react";
import { Anchor, Radio, Wifi, Shield, Activity } from "lucide-react";
import { ferryRoutes, getSimulatedPositions } from "@/data/ferries";
import type { FerryRoute } from "@/data/ferries";

interface HudOverlayProps {
  onSelectRoute: (route: FerryRoute) => void;
  selectedRouteId: string | null;
}

export default function HudOverlay({ onSelectRoute, selectedRouteId }: HudOverlayProps) {
  const [time, setTime] = useState(new Date());
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date());
      setActiveCount(getSimulatedPositions().length);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col p-3 md:p-4">
      {/* Top bar */}
      <div className="flex items-start justify-between mb-auto">
        {/* Title */}
        <div className="pointer-events-auto hud-panel px-3 py-2 md:px-4 md:py-3">
          <div className="flex items-center gap-2">
            <Anchor className="text-primary" size={16} />
            <h1 className="font-display text-sm md:text-base font-bold tracking-widest text-primary neon-text">
              AMS FERRY
            </h1>
          </div>
          <p className="text-muted-foreground text-[9px] md:text-[10px] tracking-wider mt-0.5">
            AMSTERDAM IJ FERRY TRACKER v2.1
          </p>
        </div>

        {/* Status */}
        <div className="pointer-events-auto hud-panel px-3 py-2 text-right">
          <p className="font-display text-sm md:text-base font-bold text-foreground neon-text tabular-nums">
            {timeStr}
          </p>
          <p className="text-muted-foreground text-[9px] tracking-wider">{dateStr}</p>
          <div className="flex items-center justify-end gap-2 mt-1">
            <span className="flex items-center gap-1 text-[9px] text-primary">
              <Wifi size={9} /> LIVE
            </span>
            <span className="flex items-center gap-1 text-[9px] text-accent">
              <Shield size={9} /> SSL
            </span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between mt-auto gap-2">
        {/* Route list */}
        <div className="pointer-events-auto flex flex-col gap-1 max-w-[200px]">
          {ferryRoutes.map((route) => (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route)}
              className={`hud-panel px-2 py-1.5 flex items-center gap-2 text-left transition-all hover:scale-[1.02] ${
                selectedRouteId === route.id ? "!border-primary" : ""
              }`}
              style={
                selectedRouteId === route.id
                  ? { borderColor: route.color, boxShadow: `0 0 10px ${route.color}44` }
                  : {}
              }
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: route.color,
                  boxShadow: route.status === "active" ? `0 0 6px ${route.color}` : undefined,
                }}
              />
              <div className="min-w-0">
                <span className="text-[10px] font-medium text-foreground block truncate">
                  {route.code}
                </span>
                <span className="text-[8px] text-muted-foreground block truncate">
                  {route.name}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="pointer-events-auto hud-panel px-3 py-2">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-primary">
              <Radio size={10} className="animate-pulse-glow" />
              {activeCount} vessels
            </span>
            <span className="flex items-center gap-1 text-accent">
              <Activity size={10} />
              {ferryRoutes.filter((r) => r.status === "active").length}/{ferryRoutes.length} routes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
