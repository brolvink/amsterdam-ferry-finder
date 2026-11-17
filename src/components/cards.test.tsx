import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DockDepartures from "@/components/DockDepartures";
import FerrySchedule from "@/components/FerrySchedule";
import { ferryRoutes, ferryStations } from "@/data/ferries";

const noop = () => undefined;

describe("cards", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Centraal Station lists both F3 and F4", () => {
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    const station = ferryStations.find((candidate) => candidate.id === "cs");
    if (!station) throw new Error("cs missing");
    render(<DockDepartures station={station} onClose={noop} userLocation={null} isFavorite={false} onToggleFavorite={noop} />);
    expect(screen.getByRole("region", { name: /^F3 to/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: /^F4 to/ })).toBeTruthy();
  });

  it("shows verdicts and a catchable boat when the visitor is near", () => {
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    const station = ferryStations.find((candidate) => candidate.id === "buik");
    if (!station) throw new Error("buik missing");
    render(
      <DockDepartures
        station={station}
        onClose={noop}
        userLocation={{ lat: station.lat + 0.002, lng: station.lng, accuracy: 20 }}
        isFavorite={false}
        onToggleFavorite={noop}
      />,
    );
    expect(screen.getAllByLabelText(/^Walking:/).length).toBeGreaterThan(0);
    expect(screen.getByText("Your boat")).toBeTruthy();
  });

  it("hides verdicts when far away", () => {
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    const station = ferryStations[0];
    render(
      <DockDepartures
        station={station}
        onClose={noop}
        userLocation={{ lat: 51.9, lng: 4.4, accuracy: 20 }}
        isFavorite={false}
        onToggleFavorite={noop}
      />,
    );
    expect(screen.queryByLabelText(/^Walking:/)).toBeNull();
    expect(screen.queryByText("Your boat")).toBeNull();
  });

  it("a route that is not sailing does not read Smooth Sailing", () => {
    // Wednesday 03:00 Amsterdam time: F7 (06:30-22:30) is resting.
    vi.setSystemTime(new Date("2026-11-18T02:00:00Z"));
    const route = ferryRoutes.find((candidate) => candidate.code === "F7");
    if (!route) throw new Error("F7 missing");
    render(<FerrySchedule route={route} onClose={noop} isFavorite={false} onToggleFavorite={noop} />);
    expect(screen.queryByText(/Smooth Sailing/)).toBeNull();
    expect(screen.getByText(/In Harbor/)).toBeTruthy();
    expect(screen.getAllByText(/Next sailing/).length).toBeGreaterThan(0);
  });

  it("route card shows both directions with a countdown, not a blanket Boarding now", () => {
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    const route = ferryRoutes.find((candidate) => candidate.code === "F4");
    if (!route) throw new Error("F4 missing");
    render(<FerrySchedule route={route} onClose={noop} isFavorite onToggleFavorite={noop} />);
    expect(screen.getAllByRole("region", { name: /^Departures from/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Remove .* as my dock/ }).getAttribute("aria-pressed")).toBe("true");
  });
});
