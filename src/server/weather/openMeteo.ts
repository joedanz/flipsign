import { z } from 'zod';
import { parseForecast, type Forecast, type Unit } from './forecast';

export type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

const defaultFetch: FetchFn = (url) => fetch(url, { signal: AbortSignal.timeout(10_000) });

const GeoResponse = z.object({
  results: z
    .array(z.object({ name: z.string(), admin1: z.string().optional(), latitude: z.number(), longitude: z.number() }))
    .optional(),
});

/** City name or postal code → coordinates. Returns null if there is no match. */
export async function geocode(query: string, fetchFn: FetchFn = defaultFetch): Promise<Place | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`geocoding failed: ${res.status}`);
  const hit = GeoResponse.parse(await res.json()).results?.[0];
  if (!hit) return null;
  return { name: [hit.name, hit.admin1].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude };
}

export async function fetchForecast(
  place: { lat: number; lon: number },
  unit: Unit,
  now: number,
  fetchFn: FetchFn = defaultFetch,
): Promise<Forecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    `&current=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=${unit === 'F' ? 'fahrenheit' : 'celsius'}&timezone=auto&forecast_days=4`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`forecast failed: ${res.status}`);
  return parseForecast(await res.json(), unit, now);
}
