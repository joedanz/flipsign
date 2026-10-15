import type { Store } from '../store/store';
import { fetchForecast, type FetchFn } from './openMeteo';

export async function refreshWeather(store: Store, now: () => number, fetchFn?: FetchFn): Promise<boolean> {
  const { location, unit } = store.get().settings;
  if (!location) return false;
  try {
    const forecast = await fetchForecast(location, unit, now(), fetchFn);
    const current = store.get().settings;
    const unchanged =
      current.unit === unit && current.location?.lat === location.lat && current.location?.lon === location.lon;
    if (!unchanged) return false; // settings changed while the request was in flight
    store.update((s) => {
      s.weather = forecast;
    });
    return true;
  } catch (err) {
    console.error('weather refresh failed:', err);
    return false;
  }
}
