import { useState, useCallback } from "react";
import FerryMap from "@/components/FerryMap";
import FerrySchedule from "@/components/FerrySchedule";
import HudOverlay from "@/components/HudOverlay";
import type { FerryRoute } from "@/data/ferries";

const Index = () => {
  const [selectedRoute, setSelectedRoute] = useState<FerryRoute | null>(null);

  const handleSelectRoute = useCallback((route: FerryRoute | null) => {
    setSelectedRoute((prev) => (prev?.id === route?.id ? null : route));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <FerryMap onSelectRoute={handleSelectRoute} selectedRouteId={selectedRoute?.id ?? null} />

      <HudOverlay
        onSelectRoute={(r) => handleSelectRoute(r)}
        selectedRouteId={selectedRoute?.id ?? null}
      />

      {selectedRoute && (
        <div className="absolute top-16 right-3 md:right-4 z-[1001] w-64 md:w-72">
          <FerrySchedule route={selectedRoute} onClose={() => setSelectedRoute(null)} />
        </div>
      )}
    </div>
  );
};

export default Index;
