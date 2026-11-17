import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PREFERENCE_KEYS, getPreference, setPreference } from "@/lib/preferences";

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export type LocationStatus = "off" | "locating" | "on";

const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 };

/**
 * "Near me" location, held in memory only. Nothing asks for permission until `start` is called
 * from a tap; a previous grant is resumed silently, and only if the visitor left Near me on.
 */
export function useUserLocation(): {
  status: LocationStatus;
  position: UserLocation | null;
  start: () => void;
  stop: () => void;
} {
  const [status, setStatus] = useState<LocationStatus>("off");
  const [position, setPosition] = useState<UserLocation | null>(null);
  const watchId = useRef<number | null>(null);
  const hasFix = useRef(false);

  const clearWatch = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    hasFix.current = false;
  }, []);

  const stop = useCallback(() => {
    clearWatch();
    setStatus("off");
    setPosition(null);
    setPreference(PREFERENCE_KEYS.nearMe, null);
  }, [clearWatch]);

  const begin = useCallback(
    (quiet: boolean) => {
      if (watchId.current !== null) return;
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        if (!quiet) toast("This browser can't tell us where you are, so Near me has to sit this one out.");
        return;
      }
      setStatus("locating");
      watchId.current = navigator.geolocation.watchPosition(
        (result) => {
          if (!hasFix.current) {
            hasFix.current = true;
            setPreference(PREFERENCE_KEYS.nearMe, "on");
          }
          setStatus("on");
          setPosition({
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
          });
        },
        (error) => {
          // A late timeout while we already have a fix is harmless: keep the last position.
          if (hasFix.current && error.code === error.TIMEOUT) return;
          clearWatch();
          setStatus("off");
          setPosition(null);
          setPreference(PREFERENCE_KEYS.nearMe, null);
          if (quiet) return;
          if (error.code === error.PERMISSION_DENIED) {
            toast("No worries, Near me is off. You can allow location for this site in your browser settings.");
          } else if (error.code === error.TIMEOUT) {
            toast("Still hunting for your spot. Try again in a moment, ideally with a view of the sky.");
          } else {
            toast("We can't find you right now. The ferries will wait, try again in a bit.");
          }
        },
        WATCH_OPTIONS,
      );
    },
    [clearWatch],
  );

  const start = useCallback(() => begin(false), [begin]);

  // Resume only when the visitor had Near me on AND the browser says permission is already granted.
  useEffect(() => {
    let cancelled = false;
    if (getPreference(PREFERENCE_KEYS.nearMe) === "on" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          if (!cancelled && permission.state === "granted") begin(true);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [begin]);

  useEffect(() => clearWatch, [clearWatch]);

  return { status, position, start, stop };
}
