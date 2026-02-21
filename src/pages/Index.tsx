import { useState, useCallback } from "react";
import FerryMap from "@/components/FerryMap";
import FerrySchedule from "@/components/FerrySchedule";
import DockDepartures from "@/components/DockDepartures";
import HudOverlay from "@/components/HudOverlay";
import SeagullCursor from "@/components/SeagullCursor";
import type { FerryDock, FerryRoute } from "@/data/ferries";
import { useAmsterdamWeather } from "@/hooks/useAmsterdamWeather";
import { cn } from "@/lib/utils";

type ThemeMode = "auto" | "day" | "night";

const Index = () => {
  const [selectedRoute, setSelectedRoute] = useState<FerryRoute | null>(null);
  const [selectedDock, setSelectedDock] = useState<FerryDock | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const { data: weather } = useAmsterdamWeather();

  const handleSelectRoute = useCallback((route: FerryRoute | null) => {
    setSelectedDock(null);
    setSelectedRoute((prev) => (prev?.id === route?.id ? null : route));
  }, []);
  const handleSelectDock = useCallback((dock: FerryDock | null) => {
    setSelectedRoute(null);
    setSelectedDock((prev) => (prev?.id === dock?.id ? null : dock));
  }, []);

  const currentHour = new Date().getHours();
  const fallbackNight = currentHour >= 18 || currentHour < 7;

  const autoIsNight = weather ? !weather.isDay : fallbackNight;
  const isNight = themeMode === "auto" ? autoIsNight : themeMode === "night";
  const isCold = weather ? weather.temperatureC <= 7 || weather.feelsLikeC <= 5 : currentHour < 9 || currentHour >= 20;
  const isWet = weather ? weather.code >= 51 && weather.code <= 99 : false;
  const isWindy = weather ? weather.windSpeedKmh >= 22 : false;

  const handleToggleTheme = useCallback(() => {
    setThemeMode((previous) => {
      if (previous === "auto") {
        return autoIsNight ? "day" : "night";
      }
      return previous === "night" ? "day" : "night";
    });
  }, [autoIsNight]);

  return (
    <div
      className={cn(
        "relative w-screen h-screen overflow-hidden bg-background weather-theme",
        isNight && "weather-theme-night",
        isCold && "weather-theme-cold",
        isWet && "weather-theme-wet",
      )}
    >
      <FerryMap
        onSelectRoute={handleSelectRoute}
        onSelectDock={handleSelectDock}
        selectedRouteId={selectedRoute?.id ?? null}
        isNight={isNight}
      />
      <div
        className={cn(
          "ac-atmosphere",
          isNight && "ac-atmosphere--night",
          isCold && "ac-atmosphere--cold",
          isWet && "ac-atmosphere--wet",
          isWindy && "ac-atmosphere--windy",
        )}
      >
        {isNight ? <div className="ac-moon-glow" /> : <div className="ac-sun-glow" />}
        <div className="ac-cloud" style={{ top: "12%", animationDelay: "-2s" }} />
        <div className="ac-cloud" style={{ top: "20%", animationDelay: "-11s", opacity: 0.65 }} />
        {isWet && (
          <>
            <div className="ac-rain ac-rain--far" />
            <div className="ac-rain ac-rain--near" />
          </>
        )}
        <div className="ac-water-shimmer" />
      </div>

      <HudOverlay
        onSelectRoute={(r) => handleSelectRoute(r)}
        selectedRouteId={selectedRoute?.id ?? null}
        themeMode={themeMode}
        isNight={isNight}
        onToggleTheme={handleToggleTheme}
        onSetThemeMode={setThemeMode}
      />

      <SeagullCursor />

      {selectedRoute && (
        <div className="absolute bottom-3 left-3 right-3 md:left-auto md:bottom-4 md:right-4 z-[1001] md:w-80">
          <FerrySchedule route={selectedRoute} onClose={() => setSelectedRoute(null)} />
        </div>
      )}

      {selectedDock && (
        <div className="absolute bottom-3 left-3 right-3 md:left-auto md:bottom-4 md:right-4 z-[1001] md:w-80">
          <DockDepartures dock={selectedDock} onClose={() => setSelectedDock(null)} />
        </div>
      )}
    </div>
  );
};

export default Index;
