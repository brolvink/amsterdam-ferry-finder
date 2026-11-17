import { useState, useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import FerryMap from "@/components/FerryMap";
import FerrySchedule from "@/components/FerrySchedule";
import DockDepartures from "@/components/DockDepartures";
import HudOverlay from "@/components/HudOverlay";
import SeagullCursor from "@/components/SeagullCursor";
import { ferryRoutes, ferryStations } from "@/data/ferries";
import { useAmsterdamHour } from "@/hooks/useAmsterdamHour";
import { useAmsterdamWeather } from "@/hooks/useAmsterdamWeather";
import { useSelection } from "@/hooks/useSelection";
import { useUserLocation } from "@/hooks/useUserLocation";
import { findNearestStation } from "@/lib/geo";
import { PREFERENCE_KEYS } from "@/lib/preferences";
import { parseFavorite, selectionEquals, serializeFavorite, type Selection } from "@/lib/selection";
import { usePreference } from "@/lib/usePreference";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ThemeMode = "auto" | "day" | "night";

function parseThemeMode(value: string | null): ThemeMode {
  return value === "day" || value === "night" ? value : "auto";
}
type CloudVariant = "ac-cloud--chunky" | "ac-cloud--wide" | "ac-cloud--puffy" | "ac-cloud--flat";

const CLOUD_VARIANTS: CloudVariant[] = ["ac-cloud--chunky", "ac-cloud--wide", "ac-cloud--puffy", "ac-cloud--flat"];

function pickRandomVariant(previous?: CloudVariant): CloudVariant {
  const nextOptions = previous ? CLOUD_VARIANTS.filter((variant) => variant !== previous) : CLOUD_VARIANTS;
  return nextOptions[Math.floor(Math.random() * nextOptions.length)];
}

const Index = () => {
  const { selection, selectRoute, selectStation, openStation, close } = useSelection();
  const [storedThemeMode, setStoredThemeMode] = usePreference(PREFERENCE_KEYS.themeMode);
  const themeMode = parseThemeMode(storedThemeMode);
  const [storedFavorite, setStoredFavorite] = usePreference(PREFERENCE_KEYS.favorite);
  const favorite = parseFavorite(storedFavorite);
  const { data: weather } = useAmsterdamWeather();
  const { status: locationStatus, position, start: startLocation, stop: stopLocation } = useUserLocation();

  const selectedRoute = selection?.kind === "route" ? (ferryRoutes.find((route) => route.id === selection.id) ?? null) : null;
  const selectedStation =
    selection?.kind === "station" ? (ferryStations.find((station) => station.id === selection.id) ?? null) : null;
  const favoriteStationId = favorite?.kind === "station" ? favorite.id : null;

  const handleSetThemeMode = useCallback((mode: ThemeMode) => setStoredThemeMode(mode), [setStoredThemeMode]);

  const toggleFavorite = useCallback(
    (target: Selection, name: string) => {
      if (selectionEquals(favorite, target)) {
        setStoredFavorite(null);
        toast(`${name} is no longer your dock.`);
      } else {
        setStoredFavorite(serializeFavorite(target));
        toast(`${name} is now your dock. It opens first next time.`);
      }
    },
    [favorite, setStoredFavorite],
  );

  // Near me: the nearest station, derived from the in-memory position only.
  const nearest = useMemo(() => (position ? findNearestStation(position, ferryStations) : null), [position]);
  const nearestRef = useRef(nearest);
  nearestRef.current = nearest;
  const openNearestWhenReady = useRef(false);
  const farAwayNoticeShown = useRef(false);

  const openNearest = useCallback(() => {
    const info = nearestRef.current;
    if (info && !info.farAway) openStation(info.station.id);
  }, [openStation]);

  const handleNearMe = useCallback(() => {
    if (locationStatus === "on" && nearestRef.current) {
      openNearest();
      return;
    }
    if (locationStatus === "off") {
      openNearestWhenReady.current = true;
      startLocation();
    }
  }, [locationStatus, openNearest, startLocation]);

  const handleTurnOffNearMe = useCallback(() => {
    openNearestWhenReady.current = false;
    farAwayNoticeShown.current = false;
    stopLocation();
  }, [stopLocation]);

  useEffect(() => {
    if (locationStatus === "off") openNearestWhenReady.current = false;
  }, [locationStatus]);

  useEffect(() => {
    if (!nearest) return;
    if (nearest.farAway) {
      if (!farAwayNoticeShown.current) {
        farAwayNoticeShown.current = true;
        openNearestWhenReady.current = false;
        toast("You're a long way from the IJ. Come back when you're closer and we'll tell you if you can make the boat.");
      }
      return;
    }
    if (openNearestWhenReady.current) {
      openNearestWhenReady.current = false;
      openStation(nearest.station.id);
    }
  }, [nearest, openStation]);

  const currentHour = useAmsterdamHour();
  const fallbackNight = currentHour >= 18 || currentHour < 7;

  const autoIsNight = weather ? !weather.isDay : fallbackNight;
  const isNight = themeMode === "auto" ? autoIsNight : themeMode === "night";
  const isCold = weather ? weather.temperatureC <= 7 || weather.feelsLikeC <= 5 : currentHour < 9 || currentHour >= 20;
  const isWet = weather ? weather.code >= 51 && weather.code <= 99 : false;
  const isWindy = weather ? weather.windSpeedKmh >= 22 : false;
  const [cloudVariants, setCloudVariants] = useState<CloudVariant[]>(["ac-cloud--chunky", "ac-cloud--wide", "ac-cloud--puffy"]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCloudVariants((current) =>
        current.map((variant) => {
          if (Math.random() < 0.4) return pickRandomVariant(variant);
          return variant;
        }),
      );
    }, 12000);

    return () => window.clearInterval(interval);
  }, []);

  const cloudDurationSeconds = useMemo(() => {
    const windSpeed = weather?.windSpeedKmh ?? 14;
    const clampedWind = Math.min(45, Math.max(0, windSpeed));
    const minDuration = 10;
    const maxDuration = 34;
    return maxDuration - (clampedWind / 45) * (maxDuration - minDuration);
  }, [weather?.windSpeedKmh]);

  const atmosphereStyle = useMemo(
    () =>
      ({
        "--cloud-duration": `${cloudDurationSeconds.toFixed(1)}s`,
      }) as CSSProperties,
    [cloudDurationSeconds],
  );

  const handleToggleTheme = useCallback(() => {
    if (themeMode === "auto") {
      handleSetThemeMode(autoIsNight ? "day" : "night");
    } else {
      handleSetThemeMode(themeMode === "night" ? "day" : "night");
    }
  }, [autoIsNight, handleSetThemeMode, themeMode]);

  return (
    <div
      className={cn(
        "relative w-screen overflow-hidden bg-background weather-theme",
        isNight && "weather-theme-night",
        isCold && "weather-theme-cold",
        isWet && "weather-theme-wet",
      )}
      style={{ minHeight: "100svh", height: "100dvh" }}
    >
      <FerryMap
        onSelectRoute={selectRoute}
        onSelectStation={selectStation}
        selectedRouteId={selectedRoute?.id ?? null}
        selectedStationId={selectedStation?.id ?? null}
        favoriteStationId={favoriteStationId}
        userLocation={position}
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
        style={atmosphereStyle}
      >
        {isNight ? <div className="ac-moon-glow" /> : <div className="ac-sun-glow" />}
        <div className={cn("ac-cloud", cloudVariants[0])} style={{ top: "5%", animationDelay: "-2s" }} />
        <div className={cn("ac-cloud", "ac-cloud--soft", cloudVariants[1])} style={{ top: "12%", animationDelay: "-11s" }} />
        <div className={cn("ac-cloud", "ac-cloud--faint", cloudVariants[2])} style={{ top: "18%", animationDelay: "-6s" }} />
      </div>

      <HudOverlay
        onSelectRoute={selectRoute}
        selectedRouteId={selectedRoute?.id ?? null}
        themeMode={themeMode}
        isNight={isNight}
        onToggleTheme={handleToggleTheme}
        onSetThemeMode={handleSetThemeMode}
        nearMeStatus={locationStatus}
        nearest={nearest}
        onNearMe={handleNearMe}
        onTurnOffNearMe={handleTurnOffNearMe}
      />

      <SeagullCursor />

      {selectedRoute && (
        <div className="absolute right-3 md:right-4 z-[1001] w-[min(20rem,calc(100vw-1.5rem))] md:w-80" style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
          <FerrySchedule
            key={selectedRoute.id}
            route={selectedRoute}
            onClose={close}
            isFavorite={selectionEquals(favorite, { kind: "route", id: selectedRoute.id })}
            onToggleFavorite={() => toggleFavorite({ kind: "route", id: selectedRoute.id }, `Ferry ${selectedRoute.code}`)}
          />
        </div>
      )}

      {selectedStation && (
        <div className="absolute right-3 md:right-4 z-[1001] w-[min(20rem,calc(100vw-1.5rem))] md:w-80" style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
          <DockDepartures
            key={selectedStation.id}
            station={selectedStation}
            onClose={close}
            userLocation={position}
            isFavorite={selectionEquals(favorite, { kind: "station", id: selectedStation.id })}
            onToggleFavorite={() => toggleFavorite({ kind: "station", id: selectedStation.id }, selectedStation.name)}
          />
        </div>
      )}
    </div>
  );
};

export default Index;
