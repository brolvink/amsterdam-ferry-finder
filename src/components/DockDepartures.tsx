import { Clock, Navigation, X } from "lucide-react";
import {
  ferryRoutes,
  type FerryDock,
  getNextDeparturesFromDock,
} from "@/data/ferries";

interface DockDeparturesProps {
  dock: FerryDock;
  onClose: () => void;
}

export default function DockDepartures({ dock, onClose }: DockDeparturesProps) {
  const routeDepartures = ferryRoutes
    .filter((route) => route.docks.some((routeDock) => routeDock.id === dock.id))
    .map((route) => ({
      route,
      departures: getNextDeparturesFromDock(route.id, dock.id),
      destination:
        route.docks[0].id === dock.id ? route.docks[1].name : route.docks[0].name,
    }));

  return (
    <div className="wood-panel-dark-card overflow-hidden animate-bounce-in backdrop-blur-[1px]">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/80 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold tracking-wide text-card-foreground">
            {dock.name}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">Departures</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-card-foreground transition-colors p-2 -mr-1 rounded-full hover:bg-muted/70 active:bg-muted/90 shrink-0"
          aria-label="Close dock departures"
        >
          <X size={20} className="md:w-[14px] md:h-[14px]" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {routeDepartures.map(({ route, departures, destination }) => (
          <div key={route.id} className="rounded-xl border border-border/60 bg-muted/45 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: route.color }}
                />
                <span className="text-xs font-bold text-card-foreground truncate">{route.code}</span>
              </div>
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Navigation size={10} />
                To {destination}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {departures.length > 0 ? (
                departures.map((time, i) => (
                  <span
                    key={`${route.id}-${time}-${i}`}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold bg-background/80 text-card-foreground border border-border/60"
                  >
                    <Clock size={10} />
                    {time}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold bg-background/80 text-muted-foreground border border-border/60">
                  No live departures yet, showing route estimates.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
