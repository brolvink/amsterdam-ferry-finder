import { Clock, Navigation, X, Anchor } from "lucide-react";
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
    <div className="wood-panel-dark-card flex flex-col min-h-[260px] md:min-h-[340px] max-h-[78vh] max-h-[78dvh] overflow-hidden animate-bounce-in backdrop-blur-[1px]">
      {/* Decorative colored header */}
      <div
        className="px-4 py-3 shrink-0 flex items-center justify-between border-b border-border/80"
        style={{ background: `linear-gradient(180deg, hsl(193 56% 58% / 0.15) 0%, hsl(193 56% 58% / 0.05) 100%)` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center border border-accent/40 shadow-sm shrink-0">
            <Anchor size={12} className="text-accent-foreground drop-shadow-sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-[15px] leading-none font-bold tracking-wide text-card-foreground">
              {dock.name}
            </span>
            <span className="text-[10px] uppercase tracking-widest mt-0.5 font-bold text-muted-foreground/80">Departures</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-card-foreground transition-colors p-2 -mr-1 rounded-full hover:bg-muted/70 active:bg-muted/90 shrink-0"
          aria-label="Close dock departures"
        >
          <X size={20} className="md:w-[14px] md:h-[14px]" />
        </button>
      </div>

      <div className="p-3.5 space-y-3 flex-1 overflow-y-auto no-scrollbar">
        {routeDepartures.map(({ route, departures, destination }) => (
          <div
            key={route.id}
            className="rounded-xl border relative overflow-hidden p-3 shadow-sm transition-transform hover:scale-[1.01]"
            style={{
              borderColor: `${route.color}40`,
              backgroundColor: `${route.color}08`,
            }}
          >
            {/* Subtle stripe pattern background for visual interest */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{ background: `repeating-linear-gradient(45deg, ${route.color}, ${route.color} 2px, transparent 2px, transparent 12px)` }}
            />

            <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="font-display shadow-sm text-sm font-bold tracking-wide text-card-foreground px-1.5 py-0.5 rounded-md border"
                  style={{
                    background: `${route.color}25`,
                    borderColor: `${route.color}60`,
                  }}
                >
                  {route.code}
                </span>
                <span className="text-[11px] font-semibold text-card-foreground/90 inline-flex flex-wrap items-center gap-1.5 mt-0.5">
                  <Navigation size={10} className="opacity-60" />
                  To {destination}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 relative z-10">
              {departures.length > 0 ? (
                departures.map((time, i) => {
                  const isNext = i === 0;
                  return (
                    <span
                      key={`${route.id}-${time}-${i}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold border transition-colors shadow-sm"
                      style={{
                        background: isNext ? `${route.color}25` : 'var(--background)',
                        borderColor: isNext ? `${route.color}60` : 'var(--border)',
                        color: isNext ? 'var(--card-foreground)' : 'var(--muted-foreground)',
                      }}
                    >
                      <Clock size={10} className={isNext ? "" : "opacity-60"} />
                      {time}
                      {isNext && <span className="ml-1 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: route.color }} />}
                    </span>
                  );
                })
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
