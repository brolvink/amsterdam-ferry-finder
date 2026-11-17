import { useCallback, useMemo, useRef, useState } from "react";
import { Moon, Sun, WifiOff, Wind } from "lucide-react";
import { AMSTERDAM_TIME_ZONE, ferryRoutes, formatAmsterdamTime } from "@/data/ferries";
import type { FerryRoute, FerryStation } from "@/data/ferries";
import { useAmsterdamWeather } from "@/hooks/useAmsterdamWeather";
import { useOnlineStatus } from "@/hooks/useInstallPrompt";
import { useNow } from "@/hooks/useNow";
import type { LocationStatus } from "@/hooks/useUserLocation";
import LofiPlayer from "@/components/LofiPlayer";
import InstallHint from "@/components/InstallHint";
import NearMeControl from "@/components/NearMeControl";
import RouteSlot from "@/components/RouteSlot";
import type { NearestStation } from "@/lib/geo";
import { getSoundEnabled } from "@/lib/preferences";

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: AMSTERDAM_TIME_ZONE,
});

interface HudOverlayProps {
  onSelectRoute: (route: FerryRoute) => void;
  selectedRouteId: string | null;
  themeMode: "auto" | "day" | "night";
  isNight: boolean;
  onToggleTheme: () => void;
  onSetThemeMode: (mode: "auto" | "day" | "night") => void;
  nearMeStatus: LocationStatus;
  nearest: NearestStation<FerryStation> | null;
  onNearMe: () => void;
  onTurnOffNearMe: () => void;
}

export default function HudOverlay({
  onSelectRoute,
  selectedRouteId,
  themeMode,
  isNight,
  onToggleTheme,
  onSetThemeMode,
  nearMeStatus,
  nearest,
  onNearMe,
  onTurnOffNearMe,
}: HudOverlayProps) {
  const now = useNow(10_000);
  const isOnline = useOnlineStatus();
  const [wobbleRouteId, setWobbleRouteId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const {
    data: weather,
    isLoading: weatherLoading,
    isError: weatherError,
  } = useAmsterdamWeather();

  // Amsterdam time for every visitor, whatever their own time zone.
  const timeStr = formatAmsterdamTime(now);
  const dateStr = dateFormatter.format(now);
  const sortedFerryRoutes = useMemo(
    () =>
      [...ferryRoutes].sort((a, b) => {
        const aNum = Number(a.code.replace(/^f/i, ""));
        const bNum = Number(b.code.replace(/^f/i, ""));
        if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
          return a.code.localeCompare(b.code);
        }
        return aNum - bNum;
      }),
    [],
  );
  const playRouteClickSound = useCallback(() => {
    if (typeof window === "undefined" || !getSoundEnabled()) return;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = audioCtxRef.current ?? new AudioContextCtor();
    audioCtxRef.current = context;

    const now = context.currentTime;
    const oscA = context.createOscillator();
    const oscB = context.createOscillator();
    const gain = context.createGain();

    oscA.type = "triangle";
    oscB.type = "sine";
    oscA.frequency.setValueAtTime(510, now);
    oscA.frequency.exponentialRampToValueAtTime(690, now + 0.07);
    oscB.frequency.setValueAtTime(760, now);
    oscB.frequency.exponentialRampToValueAtTime(420, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(context.destination);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.13);
    oscB.stop(now + 0.13);
  }, []);

  const handleRouteClick = useCallback((route: FerryRoute) => {
    setWobbleRouteId(route.id);
    window.setTimeout(() => setWobbleRouteId((current) => (current === route.id ? null : current)), 320);
    playRouteClickSound();
    onSelectRoute(route);
  }, [onSelectRoute, playRouteClickSound]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col p-3 md:p-4 overflow-hidden">
      <div className="mb-auto flex flex-col items-end">
        {/* Top bar */}
        <div className="pointer-events-auto wood-panel-dark px-3 py-2 md:px-5 md:py-3 w-full md:w-fit">
          <div className="flex items-start justify-between gap-2 md:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-lg inline-flex items-center leading-none shrink-0">
                  <img src="/ferry-indicator.png" alt="Ferry" className="w-8 h-8 md:w-12 md:h-12" />
                </span>
                <h1 className="font-display text-lg md:text-xl font-bold tracking-wide text-amber-100 truncate">
                  ferry.nice
                </h1>
              </div>
              <div className="flex items-center gap-1 md:gap-1.5 shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => onSetThemeMode("auto")}
                  className={`hit-44 h-7 px-2 rounded-lg text-[10px]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 font-bold tracking-wide border transition-colors ${themeMode === "auto"
                    ? "bg-amber-100/25 text-amber-100 border-amber-100/60"
                    : "bg-amber-100/8 text-amber-100/80 border-amber-100/30 hover:bg-amber-100/16"
                    }`}
                  aria-label="Use automatic day and night mode"
                >
                  AUTO
                </button>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="hit-44 h-7 w-7 md:w-auto md:px-2 rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 border-amber-100/30 bg-amber-100/8 text-amber-100 hover:bg-amber-100/16 transition-colors inline-flex items-center justify-center shrink-0"
                  aria-label={isNight ? "Switch to day mode" : "Switch to night mode"}
                >
                  {isNight ? <Sun size={16} className="md:w-[14px] md:h-[14px]" /> : <Moon size={16} className="md:w-[14px] md:h-[14px]" />}
                </button>
                <LofiPlayer />
              </div>
            </div>

            <div className="min-w-[120px] md:min-w-[150px] shrink-0 border-l border-amber-100/20 pl-2 md:pl-3 text-right">
              <p className="font-display text-lg md:text-xl font-bold text-amber-50 leading-none">
                {timeStr}
              </p>
              <p className="text-amber-100/75 text-[10px] font-semibold">{dateStr}</p>
              <p className="text-[10px] mt-1 font-semibold text-amber-50/95">
                {weatherLoading && "Loading weather..."}
                {weatherError && "Weather unavailable"}
                {weather && `${Math.round(weather.temperatureC)}°C · ${weather.label}`}
              </p>
              {weather && (
                <p className="text-[9px] text-amber-100/75 font-medium flex items-center justify-end gap-1 mt-0.5">
                  <Wind size={10} />
                  {Math.round(weather.windSpeedKmh)} km/h · feels {Math.round(weather.feelsLikeC)}°C
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status row: Near me, offline and install notes */}
        <div className="flex flex-wrap items-center justify-end gap-2 mt-2 max-w-full">
          {!isOnline && (
            <span
              className="pointer-events-auto wood-panel-dark inline-flex items-center gap-1.5 !rounded-full px-3 py-1.5 text-[11px] font-bold text-amber-100"
              role="status"
            >
              <WifiOff size={13} aria-hidden="true" />
              Offline — timetable still works
            </span>
          )}
          <NearMeControl status={nearMeStatus} nearest={nearest} onNearMe={onNearMe} onTurnOff={onTurnOffNearMe} />
          <InstallHint />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-end mt-6 md:mt-auto gap-2">
        {/* Route list — like AC inventory slots */}
        <div className="pointer-events-auto flex flex-col gap-1.5 w-full md:w-[210px] md:max-w-[210px] md:items-end">
          <p className="text-amber-100/60 text-[9px] font-bold tracking-widest uppercase md:hidden px-1 text-right">
            Ferry lines
          </p>
          <div className="flex md:flex-col justify-start gap-2 md:gap-1.5 overflow-x-auto md:overflow-y-auto no-scrollbar pb-1 md:pb-0 scroll-smooth px-0.5 w-full">
            {sortedFerryRoutes.map((route) => (
              <RouteSlot
                key={route.id}
                route={route}
                now={now}
                isSelected={selectedRouteId === route.id}
                isWobbling={wobbleRouteId === route.id}
                onSelect={handleRouteClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>

  );
}
