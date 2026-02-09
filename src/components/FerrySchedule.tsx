import { Clock, Navigation, Zap, AlertTriangle } from "lucide-react";
import { type FerryRoute, getNextDepartures } from "@/data/ferries";

interface FerryScheduleProps {
  route: FerryRoute;
  onClose: () => void;
}

export default function FerrySchedule({ route, onClose }: FerryScheduleProps) {
  const departures = getNextDepartures(route.id);

  return (
    <div className="hud-panel p-4 animate-slide-in-left" style={{ animationDuration: "0.3s" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full pulse-dot"
            style={{ background: route.color, boxShadow: `0 0 8px ${route.color}` }}
          />
          <span className="font-display text-sm font-bold tracking-wider" style={{ color: route.color }}>
            {route.code}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          [ESC]
        </button>
      </div>

      <h3 className="text-foreground font-semibold text-base mb-1">{route.name}</h3>
      <p className="text-muted-foreground text-xs mb-4">
        {route.docks[0].name} ↔ {route.docks[1].name}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-muted/50 p-2 rounded-sm border border-border/50">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
            <Clock size={10} /> Freq
          </div>
          <p className="text-foreground text-xs font-medium">{route.frequency}</p>
        </div>
        <div className="bg-muted/50 p-2 rounded-sm border border-border/50">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
            <Navigation size={10} /> Duration
          </div>
          <p className="text-foreground text-xs font-medium">{route.duration} min</p>
        </div>
        <div className="bg-muted/50 p-2 rounded-sm border border-border/50">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
            <Zap size={10} /> Status
          </div>
          <p className="text-xs font-medium flex items-center gap-1" style={{ color: route.status === "active" ? route.color : undefined }}>
            {route.status === "delayed" && <AlertTriangle size={10} className="text-destructive" />}
            {route.status.toUpperCase()}
          </p>
        </div>
        <div className="bg-muted/50 p-2 rounded-sm border border-border/50">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
            <Clock size={10} /> Hours
          </div>
          <p className="text-foreground text-xs font-medium">{route.operatingHours}</p>
        </div>
      </div>

      {/* Departures */}
      <div>
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-display">
          Next Departures
        </h4>
        <div className="space-y-1">
          {departures.map((time, i) => (
            <div
              key={time + i}
              className="flex items-center justify-between text-xs py-1 px-2 rounded-sm hover:bg-muted/50 transition-colors"
              style={{ animationDelay: `${i * 60}ms`, animation: "float-up 0.4s ease-out forwards", opacity: 0 }}
            >
              <span className="text-foreground font-medium">{time}</span>
              <span className="text-muted-foreground">
                {i === 0 ? (
                  <span style={{ color: route.color }} className="font-medium">
                    NEXT ▸
                  </span>
                ) : (
                  `+${i * parseInt(route.frequency.match(/\d+/)?.[0] || "10")}m`
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
