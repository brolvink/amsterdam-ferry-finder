import { Loader2, LocateFixed, Locate } from "lucide-react";
import type { FerryStation } from "@/data/ferries";
import type { LocationStatus } from "@/hooks/useUserLocation";
import { formatDistance, type NearestStation } from "@/lib/geo";

interface NearMeControlProps {
  status: LocationStatus;
  nearest: NearestStation<FerryStation> | null;
  onNearMe: () => void;
  onTurnOff: () => void;
}

const pillClass =
  "pointer-events-auto wood-panel-dark inline-flex items-center gap-1.5 min-h-11 md:min-h-9 px-3 text-[11px] font-bold text-amber-100 transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 !rounded-full";

/** "Near me": asks for location only when tapped; once on, opens the nearest station's card. */
export default function NearMeControl({ status, nearest, onNearMe, onTurnOff }: NearMeControlProps) {
  if (status === "off") {
    return (
      <button
        type="button"
        onClick={onNearMe}
        className={pillClass}
        aria-pressed={false}
        aria-label="Near me: find the closest ferry dock"
      >
        <Locate size={14} aria-hidden="true" />
        Near me
      </button>
    );
  }

  if (status === "locating") {
    return (
      <span className={pillClass} role="status" aria-live="polite">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Finding you…
      </span>
    );
  }

  const label = nearest && !nearest.farAway ? `${nearest.station.name} · ${formatDistance(nearest.distanceMeters)}` : "Far from the water";

  return (
    <div className="pointer-events-auto flex items-center gap-1.5 max-w-full" role="group" aria-label="Near me is on">
      <button
        type="button"
        onClick={onNearMe}
        className={`${pillClass} min-w-0`}
        aria-label={
          nearest && !nearest.farAway
            ? `Open nearest dock: ${nearest.station.name}, ${formatDistance(nearest.distanceMeters)} away`
            : "You are far from every ferry dock"
        }
      >
        <LocateFixed size={14} className="shrink-0 text-emerald-300" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
      <button
        type="button"
        onClick={onTurnOff}
        className={`${pillClass} shrink-0`}
        aria-pressed={true}
        aria-label="Turn Near me off"
      >
        Off
      </button>
    </div>
  );
}
