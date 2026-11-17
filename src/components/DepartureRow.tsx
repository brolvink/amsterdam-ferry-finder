import { Bike, Footprints } from "lucide-react";
import type { FerryDeparture } from "@/data/ferries";
import type { CatchVerdict, TravelMode } from "@/lib/geo";
import { formatCountdown, isBoardingNow } from "@/lib/countdown";
import { cn } from "@/lib/utils";

export interface DepartureVerdicts {
  walk: CatchVerdict;
  bike: CatchVerdict;
}

const VERDICT_WORDS: Record<TravelMode, Record<CatchVerdict, string>> = {
  walk: { comfortable: "easy walk", hurry: "run!", "too-late": "missed" },
  bike: { comfortable: "bike it", hurry: "pedal!", "too-late": "missed" },
};

const VERDICT_STYLES: Record<CatchVerdict, string> = {
  comfortable: "border-emerald-300/50 bg-emerald-400/15 text-emerald-200",
  hurry: "border-amber-300/60 bg-amber-300/20 text-amber-100",
  "too-late": "border-border/70 bg-background/20 text-muted-foreground line-through decoration-1",
};

function VerdictBadge({ mode, verdict }: { mode: TravelMode; verdict: CatchVerdict }) {
  const Icon = mode === "walk" ? Footprints : Bike;
  const words = VERDICT_WORDS[mode][verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap",
        VERDICT_STYLES[verdict],
      )}
      aria-label={`${mode === "walk" ? "Walking" : "Cycling"}: ${words}`}
    >
      <Icon size={10} aria-hidden="true" />
      {words}
    </span>
  );
}

interface DepartureRowProps {
  departure: FerryDeparture;
  color: string;
  /** Highlights the next boat of the list with a pulsing dot. */
  isNext?: boolean;
  /** Reads "Boarding now" for sailings within a minute (route card). */
  friendlyBoarding?: boolean;
  verdicts?: DepartureVerdicts | null;
  /** The first departure the visitor can actually catch. */
  isCatch?: boolean;
  /** Tighter layout for the two-column route card. */
  compact?: boolean;
  /** Position in the list, used to stagger the entrance. */
  index?: number;
}

/** One sailing: clock time, live countdown and, when location is on, can-I-make-it verdicts. */
export default function DepartureRow({
  departure,
  color,
  isNext = false,
  friendlyBoarding = false,
  verdicts = null,
  isCatch = false,
  compact = false,
  index = 0,
}: DepartureRowProps) {
  const boarding = isBoardingNow(departure.minutesUntil);
  const countdown = friendlyBoarding && boarding ? "Boarding now" : formatCountdown(departure.minutesUntil);
  const bothMissed = verdicts?.walk === "too-late" && verdicts.bike === "too-late";

  return (
    <li
      className={cn(
        "float-in flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl py-1.5 text-xs font-medium",
        compact ? "px-1.5 justify-between" : "px-2.5",
        isCatch ? "border" : "border border-transparent",
        bothMissed && "opacity-60",
      )}
      style={{
        animationDelay: `${index * 50}ms`,
        ...(isCatch ? { background: `${color}30`, borderColor: `${color}99` } : null),
      }}
      data-catch={isCatch || undefined}
    >
      <span className={cn("shrink-0 font-bold tabular-nums text-card-foreground", !compact && "w-11")}>{departure.label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 tabular-nums",
          isNext ? "font-bold text-card-foreground" : "text-muted-foreground",
        )}
      >
        {isNext && (
          <span
            className="pulse-dot inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        )}
        {countdown}
      </span>
      {verdicts && (
        <span className="ml-auto flex items-center gap-1">
          {bothMissed ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none",
                VERDICT_STYLES["too-late"],
              )}
              aria-label="Walking and cycling: missed"
            >
              missed
            </span>
          ) : (
            <>
              <VerdictBadge mode="walk" verdict={verdicts.walk} />
              <VerdictBadge mode="bike" verdict={verdicts.bike} />
            </>
          )}
        </span>
      )}
      {isCatch && (
        <span className="basis-full text-[10px] font-bold uppercase tracking-wider text-card-foreground/90">
          Your boat
        </span>
      )}
    </li>
  );
}
