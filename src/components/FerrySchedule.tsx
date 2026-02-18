import { Clock, Navigation, Zap, AlertTriangle, X, Leaf } from "lucide-react";
import { type FerryRoute, getNextDepartures } from "@/data/ferries";

interface FerryScheduleProps {
  route: FerryRoute;
  onClose: () => void;
}

export default function FerrySchedule({ route, onClose }: FerryScheduleProps) {
  const departures = getNextDepartures(route.id);

  return (
    <div className="wood-panel overflow-hidden animate-bounce-in">
      {/* Colored header bar */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: route.color + "22" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full shadow-sm"
            style={{ background: route.color }}
          />
          <span className="font-display text-sm font-bold tracking-wide" style={{ color: route.color }}>
            {route.code}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4">
        <h3 className="text-foreground font-display font-bold text-base mb-0.5">{route.name}</h3>
        <p className="text-muted-foreground text-xs mb-4 font-medium">
          {route.docks[0].name} ↔ {route.docks[1].name}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-muted/50 p-2.5 rounded-xl">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Clock size={10} /> Freq
            </div>
            <p className="text-foreground text-xs font-bold">{route.frequency}</p>
          </div>
          <div className="bg-muted/50 p-2.5 rounded-xl">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Navigation size={10} /> Trip
            </div>
            <p className="text-foreground text-xs font-bold">{route.duration} min</p>
          </div>
          <div className="bg-muted/50 p-2.5 rounded-xl">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Leaf size={10} /> Status
            </div>
            <p className="text-xs font-bold flex items-center gap-1" style={{ color: route.status === "active" ? route.color : undefined }}>
              {route.status === "delayed" && <AlertTriangle size={10} className="text-destructive" />}
              {route.status === "active" ? "Sailing! ⛵" : route.status.toUpperCase()}
            </p>
          </div>
          <div className="bg-muted/50 p-2.5 rounded-xl">
            <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
              <Clock size={10} /> Hours
            </div>
            <p className="text-foreground text-xs font-bold">{route.operatingHours}</p>
          </div>
        </div>

        {/* Departures */}
        <div>
          <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-display font-bold">
            🕐 Next Departures
          </h4>
          <div className="space-y-1">
            {departures.map((time, i) => (
              <div
                key={time + i}
                className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl hover:bg-muted/50 transition-colors font-medium"
                style={{ animationDelay: `${i * 60}ms`, animation: "float-up 0.4s ease-out forwards", opacity: 0 }}
              >
                <span className="text-foreground font-bold">{time}</span>
                <span className="text-muted-foreground">
                  {i === 0 ? (
                    <span style={{ color: route.color }} className="font-bold">
                      Next! 🚢
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
    </div>
  );
}
