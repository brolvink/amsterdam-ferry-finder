import { Bike, Footprints, MapPin } from "lucide-react";
import { formatDistance, type NearestStation } from "@/lib/geo";
import type { FerryStation } from "@/data/ferries";

/** Distance and walk/bike times from the visitor to this station. */
export default function StationVerdictNote({ info }: { info: NearestStation<FerryStation> }) {
  return (
    <div
      className="mx-3.5 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-[11px] font-semibold text-card-foreground"
      aria-label={`You are ${formatDistance(info.distanceMeters)} away: ${info.walkMinutes} minutes on foot, ${info.bikeMinutes} minutes by bike`}
    >
      <span className="inline-flex items-center gap-1">
        <MapPin size={11} aria-hidden="true" /> {formatDistance(info.distanceMeters)} away
      </span>
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Footprints size={11} aria-hidden="true" /> {info.walkMinutes} min
      </span>
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Bike size={11} aria-hidden="true" /> {info.bikeMinutes} min
      </span>
    </div>
  );
}
