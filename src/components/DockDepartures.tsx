import { useMemo } from "react";
import { Anchor, Navigation } from "lucide-react";
import {
  ferryRoutes,
  getDockDepartures,
  getStationForDock,
  type DockDeparturesResult,
  type FerryRoute,
  type FerryStation,
} from "@/data/ferries";
import CardActions from "@/components/CardActions";
import DepartureRow, { type DepartureVerdicts } from "@/components/DepartureRow";
import StationVerdictNote from "@/components/StationVerdictNote";
import { useNow } from "@/hooks/useNow";
import type { UserLocation } from "@/hooks/useUserLocation";
import { describeNextSailing } from "@/lib/countdown";
import { findNearestStation, getCatchVerdict, type NearestStation } from "@/lib/geo";
import { buildShareUrl } from "@/lib/selection";

const DEPARTURES_SHOWN = 4;

interface DockDeparturesProps {
  station: FerryStation;
  onClose: () => void;
  userLocation: UserLocation | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

interface Block {
  route: FerryRoute;
  dockId: string;
  destination: string;
  result: DockDeparturesResult;
}

function getBlocks(station: FerryStation, now: number): Block[] {
  const blocks: Block[] = [];
  for (const route of ferryRoutes) {
    for (const dock of route.docks) {
      if (!station.dockIds.includes(dock.id)) continue;
      const result = getDockDepartures(route.id, dock.id, { now, count: DEPARTURES_SHOWN });
      if (!result) continue;
      blocks.push({
        route,
        dockId: dock.id,
        destination: getStationForDock(result.destinationDockId)?.name ?? "the other side",
        result,
      });
    }
  }
  return blocks;
}

export default function DockDepartures({
  station,
  onClose,
  userLocation,
  isFavorite,
  onToggleFavorite,
}: DockDeparturesProps) {
  const now = useNow(10_000);
  const blocks = useMemo(() => getBlocks(station, now), [station, now]);

  // Verdicts only make sense when the visitor is within reach of this station.
  const travel: NearestStation<FerryStation> | null = useMemo(() => {
    if (!userLocation) return null;
    const info = findNearestStation(userLocation, [station]);
    return info && !info.farAway ? info : null;
  }, [userLocation, station]);

  return (
    <div className="wood-panel-dark-card flex flex-col min-h-[260px] md:min-h-[340px] max-h-[78vh] max-h-[78dvh] overflow-hidden animate-bounce-in backdrop-blur-[1px]">
      <div
        className="px-4 py-2 md:py-3 shrink-0 flex items-center justify-between gap-2 border-b border-border/80"
        style={{ background: `linear-gradient(180deg, hsl(193 56% 58% / 0.15) 0%, hsl(193 56% 58% / 0.05) 100%)` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center border border-accent/40 shadow-sm shrink-0">
            <Anchor size={12} className="text-accent-foreground drop-shadow-sm" aria-hidden="true" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-display text-[15px] leading-none font-bold tracking-wide text-card-foreground truncate">
              {station.name}
            </h3>
            <span className="text-[10px] uppercase tracking-widest mt-0.5 font-bold text-muted-foreground/80">
              Bell Board
            </span>
          </div>
        </div>
        <CardActions
          label={station.name}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          shareUrl={buildShareUrl({ kind: "station", id: station.id }, window.location)}
          onClose={onClose}
        />
      </div>

      {travel && <StationVerdictNote info={travel} />}

      <div className="p-3.5 space-y-3 flex-1 overflow-y-auto no-scrollbar">
        {blocks.map(({ route, dockId, destination, result }) => {
          const catchIndex = travel
            ? result.departures.findIndex((departure) => {
                const ms = departure.timestamp - now;
                return (
                  getCatchVerdict(ms, travel.walkMinutes) !== "too-late" ||
                  getCatchVerdict(ms, travel.bikeMinutes) !== "too-late"
                );
              })
            : -1;

          return (
            <section
              key={`${route.id}-${dockId}`}
              aria-label={`${route.code} to ${destination}`}
              className="rounded-xl border relative overflow-hidden p-3 shadow-sm"
              style={{ borderColor: `${route.color}40`, backgroundColor: `${route.color}08` }}
            >
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ background: `repeating-linear-gradient(45deg, ${route.color}, ${route.color} 2px, transparent 2px, transparent 12px)` }}
              />

              <div className="flex items-center gap-2 min-w-0 mb-2 relative z-10">
                <span
                  className="font-display shadow-sm text-sm font-bold tracking-wide text-card-foreground px-1.5 py-0.5 rounded-md border"
                  style={{ background: `${route.color}25`, borderColor: `${route.color}60` }}
                >
                  {route.code}
                </span>
                <span className="text-[11px] font-semibold text-card-foreground/90 inline-flex items-center gap-1.5 min-w-0">
                  <Navigation size={10} className="opacity-60 shrink-0" aria-hidden="true" />
                  <span className="truncate">To {destination}</span>
                </span>
              </div>

              <div className="relative z-10">
                {result.departures.length > 0 ? (
                  <ul className="space-y-0.5">
                    {result.departures.map((departure, i) => {
                      const ms = departure.timestamp - now;
                      const verdicts: DepartureVerdicts | null = travel
                        ? {
                            walk: getCatchVerdict(ms, travel.walkMinutes),
                            bike: getCatchVerdict(ms, travel.bikeMinutes),
                          }
                        : null;
                      return (
                        <DepartureRow
                          key={departure.timestamp}
                          departure={departure}
                          color={route.color}
                          isNext={i === 0}
                          verdicts={verdicts}
                          isCatch={i === catchIndex}
                          index={i}
                        />
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-lg border border-border/60 bg-background/20 px-2.5 py-2 text-xs font-semibold text-muted-foreground">
                    {describeNextSailing(result.next)}
                  </p>
                )}
                {result.scheduleSource === "estimated" && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Estimated times, based on the usual rhythm.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
