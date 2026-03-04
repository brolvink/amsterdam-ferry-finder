import { Clock, Navigation, AlertTriangle, X, Leaf } from "lucide-react";
import { type FerryRoute, getNextDepartures, getScheduleMeta } from "@/data/ferries";

interface FerryScheduleProps {
  route: FerryRoute;
  onClose: () => void;
}

export default function FerrySchedule({ route, onClose }: FerryScheduleProps) {
  const departures = getNextDepartures(route.id);
  const scheduleMeta = getScheduleMeta();
  const hasDepartures = departures.length > 0;
  const estimatedIntervalMinutes = Number.parseInt(route.frequency.match(/\d+/)?.[0] ?? "10", 10);
  const isEstimatedIntervalValid = Number.isFinite(estimatedIntervalMinutes) && estimatedIntervalMinutes > 0;
  const statusText =
    route.status === "active" ? "Smooth Sailing" : route.status === "delayed" ? "Running Late" : "In Harbor";

  return (
    <div className="wood-panel-dark-card overflow-hidden animate-bounce-in backdrop-blur-[1px]">
      {/* Colored header bar */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-border/80"
        style={{ background: `linear-gradient(180deg, ${route.color}2b 0%, ${route.color}18 100%)` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full shadow-sm"
            style={{ background: route.color }}
          />
          <span
            className="font-display text-sm font-bold tracking-wide text-card-foreground px-1.5 py-0.5 rounded-md border"
            style={{
              background: `${route.color}20`,
              borderColor: `${route.color}66`,
            }}
          >
            {route.code}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">Harbor Note</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-card-foreground transition-colors p-2 -mr-1 rounded-full hover:bg-muted/70 active:bg-muted/90 shrink-0"
          aria-label="Close route details"
        >
          <X size={20} className="md:w-[14px] md:h-[14px]" />
        </button>
      </div>

      <div className="p-4">
        <h3 className="text-card-foreground font-display font-bold text-base mb-0.5">{route.name}</h3>
        <p className="text-muted-foreground text-xs mb-4 font-medium">
          {route.docks[0].name} ↔ {route.docks[1].name}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Clock size={10} /> Sailing Rhythm
            </div>
            <p className="text-card-foreground text-xs font-bold">{route.frequency}</p>
          </div>
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Navigation size={10} /> Crossing Time
            </div>
            <p className="text-card-foreground text-xs font-bold">{route.duration} min</p>
          </div>
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Leaf size={10} /> Harbor Mood
            </div>
            <p className="text-xs font-bold flex items-center gap-1 text-card-foreground">
              {route.status === "delayed" && <AlertTriangle size={10} className="text-destructive" />}
              {route.status === "active" && (
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: route.color }} />
              )}
              {statusText}
            </p>
          </div>
          <div className="bg-muted/45 p-2.5 rounded-xl border border-border/60">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Clock size={10} /> Harbor Hours
            </div>
            <p className="text-card-foreground text-xs font-bold">{route.operatingHours}</p>
          </div>
        </div>

        {/* Departures */}
        <div>
          <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-display font-bold">
            Bell Board: {hasDepartures ? "Next Boats" : "Estimated Service"}
          </h4>
          <div className="space-y-1">
            {hasDepartures ? (
              departures.map((time, i) => (
                <div
                  key={time + i}
                  className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl hover:bg-muted/55 transition-colors font-medium"
                  style={{ animationDelay: `${i * 60}ms`, animation: "float-up 0.4s ease-out forwards", opacity: 0 }}
                >
                  <span className="text-card-foreground font-bold">{time}</span>
                  <span className="text-muted-foreground">
                    {i === 0 ? (
                      <span className="font-bold text-card-foreground inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: route.color }} />
                        Boarding now
                      </span>
                    ) : (
                      `+${i * (isEstimatedIntervalValid ? estimatedIntervalMinutes : 10)}m`
                    )}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs py-2 px-3 rounded-xl bg-muted/45 border border-border/60 text-muted-foreground font-medium">
                Limited timetable data. Service is estimated around every {isEstimatedIntervalValid ? estimatedIntervalMinutes : 10} min.
              </div>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Timetable source: {scheduleMeta.source} · updated{" "}
            {new Date(scheduleMeta.lastUpdated).toLocaleDateString("nl-NL")} ({scheduleMeta.refreshCadence})
          </p>
        </div>
      </div>
    </div>
  );
}
