import { useQuery } from "@tanstack/react-query";

const AMSTERDAM_LATITUDE = 52.3676;
const AMSTERDAM_LONGITUDE = 4.9041;
const WEATHER_ENDPOINT =
  `https://api.open-meteo.com/v1/forecast?latitude=${AMSTERDAM_LATITUDE}&longitude=${AMSTERDAM_LONGITUDE}` +
  "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=Europe%2FAmsterdam";

interface OpenMeteoCurrent {
  temperature_2m: number;
  apparent_temperature: number;
  weather_code: number;
  wind_speed_10m: number;
  is_day: number;
}

interface OpenMeteoWeatherResponse {
  current?: OpenMeteoCurrent;
}

export interface AmsterdamWeather {
  temperatureC: number;
  feelsLikeC: number;
  windSpeedKmh: number;
  code: number;
  isDay: boolean;
  label: string;
}

function mapWeatherCodeToLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

async function fetchAmsterdamWeather(signal?: AbortSignal): Promise<AmsterdamWeather> {
  const response = await fetch(WEATHER_ENDPOINT, { signal });
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoWeatherResponse;
  if (!payload.current) {
    throw new Error("Weather data missing in response");
  }

  return {
    temperatureC: payload.current.temperature_2m,
    feelsLikeC: payload.current.apparent_temperature,
    windSpeedKmh: payload.current.wind_speed_10m,
    code: payload.current.weather_code,
    isDay: payload.current.is_day === 1,
    label: mapWeatherCodeToLabel(payload.current.weather_code),
  };
}

export function useAmsterdamWeather() {
  return useQuery({
    queryKey: ["amsterdam-weather"],
    queryFn: ({ signal }) => fetchAmsterdamWeather(signal),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });
}
