import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun, Leaf, Wind } from "lucide-react";
import { ferryRoutes } from "@/data/ferries";
import type { FerryRoute } from "@/data/ferries";
import { useAmsterdamWeather } from "@/hooks/useAmsterdamWeather";
import LofiPlayer from "@/components/LofiPlayer";

interface HudOverlayProps {
  onSelectRoute: (route: FerryRoute) => void;
  selectedRouteId: string | null;
  themeMode: "auto" | "day" | "night";
  isNight: boolean;
  onToggleTheme: () => void;
  onSetThemeMode: (mode: "auto" | "day" | "night") => void;
}

export default function HudOverlay({
  onSelectRoute,
  selectedRouteId,
  themeMode,
  isNight,
  onToggleTheme,
  onSetThemeMode,
}: HudOverlayProps) {
  const [time, setTime] = useState(new Date());
  const [wobbleRouteId, setWobbleRouteId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const {
    data: weather,
    isLoading: weatherLoading,
    isError: weatherError,
  } = useAmsterdamWeather();

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = time.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const moodText = weather
    ? !weather.isDay
      ? weather.temperatureC <= 7
        ? "Night Chill"
        : "Night Harbor"
      : weather.temperatureC <= 7
        ? "Crisp Morning"
        : "Island Time"
    : "Island Time";
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
  const mascotMessage = useMemo(() => {
    if (!weather) return "Scout Gull says: mellow tides and smooth routes.";
    if (!weather.isDay) {
      return weather.temperatureC <= 7
        ? "Scout Gull says: bundle up, it is crisp on deck."
        : "Scout Gull says: calm night crossings ahead.";
    }
    if (weather.code >= 51 && weather.code <= 99) {
      return "Scout Gull says: drizzle watch, mind slippery docks.";
    }
    if (weather.windSpeedKmh >= 22) {
      return "Scout Gull says: breezy sails, hold your cap tight.";
    }
    return "Scout Gull says: golden weather for harbor hopping.";
  }, [weather]);

  const playRouteClickSound = useCallback(() => {
    if (typeof window === "undefined") return;
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
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-auto">
        {/* Title — wooden sign style */}
        <div className="pointer-events-auto wood-panel-dark px-4 py-2.5 md:px-5 md:py-3 w-full sm:w-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg inline-flex items-center leading-none shrink-0">
                <img src="/ferry-indicator.png" alt="Ferry" className="w-10 h-10 md:w-12 md:h-12" />
              </span>
              <h1 className="font-display text-base md:text-lg font-bold tracking-wide text-amber-100">
                ferrynice
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSetThemeMode("auto")}
                className={`h-8 md:h-7 px-2.5 md:px-2 rounded-lg text-[11px] md:text-[10px] font-bold tracking-wide border transition-colors ${themeMode === "auto"
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
                className="h-8 w-8 md:h-7 md:w-auto md:px-2 rounded-lg border border-amber-100/30 bg-amber-100/8 text-amber-100 hover:bg-amber-100/16 transition-colors inline-flex items-center justify-center shrink-0"
                aria-label={isNight ? "Switch to day mode" : "Switch to night mode"}
              >
                {isNight ? <Sun size={16} className="md:w-[14px] md:h-[14px]" /> : <Moon size={16} className="md:w-[14px] md:h-[14px]" />}
              </button>
              <LofiPlayer />
            </div>
          </div>
          <div className="mascot-note mt-2 md:mt-1.5 w-full">
            <span className="mascot-note__icon" aria-hidden="true">🕊️</span>
            <p className="text-[9px] md:text-[10px]">{mascotMessage}</p>
          </div>
        </div>

        {/* Clock — like a Nook Phone widget */}
        <div className="pointer-events-auto wood-panel-dark-card px-3 py-2 text-right self-end sm:self-auto min-w-[140px]">
          <p className="font-display text-lg md:text-xl font-bold text-card-foreground leading-none">
            {timeStr}
          </p>
          <p className="text-muted-foreground text-[10px] font-semibold">{dateStr}</p>
          <p className="text-[10px] mt-1 font-semibold text-card-foreground/90">
            {weatherLoading && "Loading weather..."}
            {weatherError && "Weather unavailable"}
            {weather && `${Math.round(weather.temperatureC)}°C · ${weather.label}`}
          </p>
          {weather && (
            <p className="text-[9px] text-muted-foreground font-medium flex items-center justify-end gap-1 mt-0.5">
              <Wind size={10} />
              {Math.round(weather.windSpeedKmh)} km/h wind · feels {Math.round(weather.feelsLikeC)}°C
            </p>
          )}
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <span className="leaf-badge text-[10px]">
              <Leaf size={10} /> {moodText}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between mt-6 md:mt-auto gap-2">
        {/* Route list — like AC inventory slots */}
        <div className="pointer-events-auto flex flex-col gap-1.5 w-full md:max-w-[210px]">
          <p className="text-amber-100/60 text-[9px] font-bold tracking-widest uppercase md:hidden px-1">
            Active Routes
          </p>
          <div className="flex md:flex-col gap-2 md:gap-1.5 overflow-x-auto md:overflow-y-auto no-scrollbar pb-1 md:pb-0 scroll-smooth px-0.5">
            {sortedFerryRoutes.map((route) => (
              <button
                key={route.id}
                onClick={() => handleRouteClick(route)}
                className={`inventory-slot flex-shrink-0 w-[140px] md:w-full ${selectedRouteId === route.id ? "inventory-slot--active" : ""} ${wobbleRouteId === route.id ? "inventory-slot--wobble" : ""}`}
                aria-label={`Open ${route.code} route card`}
              >
                <div
                  className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${selectedRouteId === route.id ? "animate-pulse-glow" : ""}`}
                  style={{
                    background: route.color,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-amber-100 block truncate leading-tight">
                    {route.code}
                  </span>
                  <span className="text-[9px] text-amber-100/80 block truncate font-semibold leading-tight">
                    {route.docks[0].name} ↔ {route.docks[1].name}
                  </span>
                </div>
                {route.status === "active" && (
                  <span className="ml-auto text-[8px] text-amber-200 font-bold">●</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

  );
}
