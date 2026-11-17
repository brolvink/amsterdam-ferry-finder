import { useMemo } from "react";
import { Clock, Navigation, AlertTriangle, Leaf, Moon } from "lucide-react";
import {
  AMSTERDAM_TIME_ZONE,
  getDockDepartures,
  getRouteServiceStatus,
  getScheduleMeta,
  getStationForDock,
  type FerryRoute,
} from "@/data/ferries";
import CardActions from "@/components/CardActions";
import DepartureRow from "@/components/DepartureRow";
import { useNow } from "@/hooks/useNow";
import { describeNextSailing, describeSailingTime } from "@/lib/countdown";
import { buildShareUrl } from "@/lib/selection";

const DEPARTURES_PER_DIRECTION = 4;

interface FerryScheduleProps {
  route: FerryRoute;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

const checkedDateFormatter = new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeZone: AMSTERDAM_TIME_ZONE });

/** Shows a bare host name instead of a long source URL. */
function formatSource(source: string): string {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
}

function stationName(dockId: string, fallback: string): string {
  return getStationForDock(dockId)?.name ?? fallback;
}

export default function FerrySchedule({ route, onClose, isFavorite, onToggleFavorite }: FerryScheduleProps) {
  const now = useNow(10_000);
  const scheduleMeta = getScheduleMeta();
  const service = useMemo(() => getRouteServiceStatus(route.id, now), [route.id, now]);
  const columns = useMemo(
    () =>
      route.docks.map((dock) => ({
        dock,
        result: getDockDepartures(route.id, dock.id, { now, count: DEPARTURES_PER_DIRECTION }),
      })),
    [route, now],
  );

  const inService = service?.inService ?? false;
  const isDelayed = inService && service?.status === "delayed";
  const moodText = isDelayed ? "Running Late" : inService ? "Smooth Sailing" : "In Harbor";
  const hourLines = route.operatingHours.split(/,\s*/).filter((line) => line.length > 0);
  const checkedDate = Number.isNaN(Date.parse(scheduleMeta.lastChecked))
    ? null
    : checkedDateFormatter.format(new Date(scheduleMeta.lastChecked));

  return (
    <div className="wood-panel-dark-card max-h-[78vh] max-h-[78dvh] overflow-y-auto no-scrollbar animate-bounce-in backdrop-blur-[1px]">
      <div
        className="px-4 py-2 md:py-3 flex items-center justify-between gap-2 border-b border-border/80"
        style={{ background: `linear-gradient(180deg, ${route.color}2b 0%, ${route.color}18 100%)` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-4 h-4 rounded-full shadow-sm shrink-0" style={{ background: route.color }} />
          <span
            className="font-display text-sm font-bold tracking-wide text-card-foreground px-1.5 py-0.5 rounded-md border"
            style={{ background: `${route.color}20`, borderColor: `${route.color}66` }}
          >
            {route.code}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground truncate">Harbor Note</span>
        </div>
        <CardActions
          label={`Ferry ${route.code}`}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          shareUrl={buildShareUrl({ kind: "route", id: route.id }, window.location)}
          onClose={onClose}
        />
      </div>

      <div className="p-4">
        <h3 className="text-card-foreground font-display font-bold text-base mb-0.5">{route.name}</h3>
        <p className="text-muted-foreground text-xs mb-4 font-medium">
          {stationName(route.docks[0].id, route.docks[0].name)} ↔ {stationName(route.docks[1].id, route.docks[1].name)}
        </p>

        <div className="mb-4">
          <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-display font-bold">
            Bell Board: {columns.some(({ result }) => (result?.departures.length ?? 0) > 0) ? "Next Boats" : "Resting"}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {columns.map(({ dock, result }) => (
              <section
                key={dock.id}
                aria-label={`Departures from ${stationName(dock.id, dock.name)}`}
                className="min-w-0 rounded-xl border border-border/60 bg-muted/25 p-1.5"
              >
                <p
                  className="px-1.5 pt-0.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight"
                  title={`From ${stationName(dock.id, dock.name)}`}
                >
                  From {stationName(dock.id, dock.name)}
                </p>
                {result && result.departures.length > 0 ? (
                  <ul className="space-y-0.5">
                    {result.departures.map((departure, i) => (
                      <DepartureRow
                        key={departure.timestamp}
                        departure={departure}
                        color={route.color}
                        isNext={i === 0}
                        friendlyBoarding
                        compact
                        index={i}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="px-1.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    {result?.next ? `Next sailing ${describeSailingTime(result.next)}` : "Nothing on the board"}
                  </p>
                )}
              </section>
            ))}
          </div>
          {!inService && (
            <p className="mt-2 rounded-xl border border-border/60 bg-muted/45 px-3 py-2 text-xs font-semibold text-muted-foreground">
              {describeNextSailing(service?.next ?? null)}
            </p>
          )}
          {route.scheduleSource === "estimated" && (
            <p className="mt-2 text-[10px] text-muted-foreground">Estimated times, based on the usual rhythm.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Clock size={10} aria-hidden="true" /> Sailing Rhythm
            </div>
            <p className="text-card-foreground text-xs font-bold">{route.frequency}</p>
          </div>
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Navigation size={10} aria-hidden="true" /> Crossing Time
            </div>
            <p className="text-card-foreground text-xs font-bold">{route.duration} min</p>
          </div>
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60 col-span-2">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Leaf size={10} aria-hidden="true" /> Harbor Mood
            </div>
            <p className="text-xs font-bold flex items-center gap-1.5 text-card-foreground">
              {isDelayed && <AlertTriangle size={10} className="text-destructive" aria-hidden="true" />}
              {inService && !isDelayed && (
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: route.color }} aria-hidden="true" />
              )}
              {!inService && <Moon size={10} aria-hidden="true" />}
              {moodText}
            </p>
          </div>
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60 col-span-2">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Clock size={10} aria-hidden="true" /> Harbor Hours
            </div>
            <ul className="text-card-foreground text-xs font-bold space-y-0.5">
              {hourLines.map((line) => (
                <li key={line} className="tabular-nums">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground">
          Timetable source: {formatSource(scheduleMeta.source)}
          {checkedDate ? ` · checked ${checkedDate}` : ""} ({scheduleMeta.refreshCadence})
        </p>
      </div>
    </div>
  );
}
