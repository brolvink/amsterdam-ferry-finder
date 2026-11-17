import { useEffect, useState } from "react";
import { getAmsterdamNow } from "@/data/ferries";

/** Current hour in Amsterdam (0-23). Re-renders only when the hour actually changes. */
export function useAmsterdamHour(): number {
  const [hour, setHour] = useState(() => getAmsterdamNow().hours);
  useEffect(() => {
    const interval = window.setInterval(() => setHour(getAmsterdamNow().hours), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return hour;
}
