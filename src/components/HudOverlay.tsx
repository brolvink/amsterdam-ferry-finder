import { useEffect, useState } from "react";
import { Moon, Ship, Sun, Leaf, MapPin, Wind } from "lucide-react";
import { ferryRoutes, getSimulatedPositions } from "@/data/ferries";
import type { FerryRoute } from "@/data/ferries";
import { useAmsterdamWeather } from "@/hooks/useAmsterdamWeather";

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
  const [activeCount, setActiveCount] = useState(0);
  const {
    data: weather,
    isLoading: weatherLoading,
    isError: weatherError,
  } = useAmsterdamWeather();

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date());
      setActiveCount(getSimulatedPositions().length);
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

  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col p-3 md:p-4">
      {/* Top bar */}
      <div className="flex items-start justify-between mb-auto">
        {/* Title — wooden sign style */}
        <div className="pointer-events-auto wood-panel-dark px-4 py-2.5 md:px-5 md:py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg inline-flex items-center leading-none">
                <img src="/ferry-indicator.png" alt="Ferry" className="w-12 h-12" />
              </span>
              <h1 className="font-display text-base md:text-lg font-bold tracking-wide text-amber-100">
                ferrynice
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSetThemeMode("auto")}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide border transition-colors ${
                  themeMode === "auto"
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
                className="h-7 px-2 rounded-lg border border-amber-100/30 bg-amber-100/8 text-amber-100 hover:bg-amber-100/16 transition-colors inline-flex items-center justify-center"
                aria-label={isNight ? "Switch to day mode" : "Switch to night mode"}
              >
                {isNight ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>
          <p className="text-amber-100/90 text-[10px] tracking-wider mt-0.5 font-semibold">
            Harbor Life Guidebook
          </p>
        </div>

        {/* Clock — like a Nook Phone widget */}
        <div className="pointer-events-auto wood-panel px-3 py-2 text-right">
          <p className="font-display text-lg md:text-xl font-bold text-foreground">
            {timeStr}
          </p>
          <p className="text-muted-foreground text-[10px] font-semibold">{dateStr}</p>
          <p className="text-[10px] mt-1 font-semibold text-foreground/90">
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
      <div className="flex items-end justify-between mt-auto gap-2">
        {/* Route list — like AC inventory slots */}
        <div className="pointer-events-auto flex flex-col gap-1.5 max-w-[210px]">
          {ferryRoutes.map((route) => (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route)}
              className={`inventory-slot ${selectedRouteId === route.id ? "inventory-slot--active" : ""}`}
              aria-label={`Open ${route.code} route card`}
            >
              <div
                className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${selectedRouteId === route.id ? "animate-pulse-glow" : ""}`}
                style={{
                  background: route.color,
                }}
              />
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-foreground block truncate">
                  {route.code}
                </span>
                <span className="text-[9px] text-foreground/75 block truncate font-semibold">
                  {route.name}
                </span>
              </div>
              {route.status === "active" && (
                <span className="ml-auto text-[8px] text-primary font-bold">●</span>
              )}
            </button>
          ))}
        </div>

        {/* Stats — like a game status bar */}
        <div className="pointer-events-auto wood-panel px-3 py-2">
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-primary">
              <Ship size={12} />
              {activeCount} sailing
            </span>
            <span className="flex items-center gap-1 text-secondary-foreground">
              <MapPin size={12} className="text-secondary" />
              {ferryRoutes.filter((r) => r.status === "active").length} harbors
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
