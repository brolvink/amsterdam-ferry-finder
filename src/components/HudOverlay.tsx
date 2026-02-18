import { useEffect, useState } from "react";
import { Anchor, Ship, Leaf, Heart, MapPin } from "lucide-react";
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
  });
  const dateStr = time.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col p-3 md:p-4">
      {/* Top bar */}
      <div className="flex items-start justify-between mb-auto">
        {/* Title — wooden sign style */}
        <div className="pointer-events-auto wood-panel-dark px-4 py-2.5 md:px-5 md:py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⛴️</span>
            <h1 className="font-display text-base md:text-lg font-bold tracking-wide text-amber-100">
              ferrynice
            </h1>
          </div>
          <p className="text-amber-200/70 text-[10px] tracking-wider mt-0.5 font-medium">
            Amsterdam Ferry Tracker 🍃
          </p>
        </div>

        {/* Clock — like a Nook Phone widget */}
        <div className="pointer-events-auto wood-panel px-3 py-2 text-right">
          <p className="font-display text-lg md:text-xl font-bold text-foreground">
            {timeStr}
          </p>
          <p className="text-muted-foreground text-[10px] font-semibold">{dateStr}</p>
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <span className="flex items-center gap-1 text-[10px] text-primary font-semibold">
              <Leaf size={10} /> Live
            </span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between mt-auto gap-2">
        {/* Route list — like AC inventory slots */}
        <div className="pointer-events-auto flex flex-col gap-1.5 max-w-[210px]">
          {ferryRoutes.map((route) => (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route)}
              className={`wood-panel px-3 py-2 flex items-center gap-2.5 text-left transition-all hover:scale-[1.03] active:scale-[0.98] ${
                selectedRouteId === route.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{
                  background: route.color,
                }}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-foreground block truncate">
                  {route.code}
                </span>
                <span className="text-[9px] text-muted-foreground block truncate font-medium">
                  {route.name}
                </span>
              </div>
              {route.status === "active" && (
                <span className="ml-auto text-[8px] text-primary font-bold">●</span>
              )}
            </button>
          ))}
        </div>

        {/* Stats — like a game status bar */}
        <div className="pointer-events-auto wood-panel px-3 py-2">
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-primary">
              <Ship size={12} />
              {activeCount} boats
            </span>
            <span className="flex items-center gap-1 text-secondary-foreground">
              <MapPin size={12} className="text-secondary" />
              {ferryRoutes.filter((r) => r.status === "active").length} routes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
