import { getDockDepartures, getRouteServiceStatus, type FerryRoute } from "@/data/ferries";
import { describeSailingTime, formatCompactNext, formatCountdown } from "@/lib/countdown";

interface RouteSlotProps {
  route: FerryRoute;
  now: number;
  isSelected: boolean;
  isWobbling: boolean;
  onSelect: (route: FerryRoute) => void;
}

/** One ferry line in the HUD list: colour, status dot and the next sailing from its first dock. */
export default function RouteSlot({ route, now, isSelected, isWobbling, onSelect }: RouteSlotProps) {
  const inService = getRouteServiceStatus(route.id, now)?.inService ?? false;
  const next = getDockDepartures(route.id, route.docks[0].id, { now, count: 1, horizonMinutes: 0 })?.next ?? null;
  const nextText = next ? formatCompactNext(next) : "--";
  const spokenNext = next
    ? next.dayOffset === 0 && next.minutesUntil < 60
      ? `next boat ${next.minutesUntil === 0 ? "now" : `in ${formatCountdown(next.minutesUntil)}`}`
      : `next boat ${describeSailingTime(next)}`
    : "no boats on the board";

  return (
    <button
      type="button"
      onClick={() => onSelect(route)}
      className={`inventory-slot flex-shrink-0 w-[140px] md:w-full min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${isSelected ? "inventory-slot--active" : ""} ${isWobbling ? "inventory-slot--wobble" : ""}`}
      aria-label={`Open ${route.code} route card, ${inService ? "sailing" : "resting"}, ${spokenNext}`}
    >
      <div
        className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${isSelected ? "animate-pulse-glow" : ""}`}
        style={{ background: route.color }}
      />
      <div className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-1 leading-tight">
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-100">
            {route.code}
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${inService ? "bg-emerald-300" : "border border-amber-100/60"}`}
              title={inService ? "Sailing now" : "Resting"}
              aria-hidden="true"
            />
          </span>
          <span className="text-[10px] font-bold tabular-nums text-amber-200 whitespace-nowrap">{nextText}</span>
        </span>
        <span className="text-[9px] text-amber-100/80 block truncate font-semibold leading-tight">
          {route.docks[0].name} ↔ {route.docks[1].name}
        </span>
      </div>
    </button>
  );
}
