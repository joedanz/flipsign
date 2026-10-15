import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../store/store';
import type { FetchFn } from './openMeteo';
import { refreshWeather } from './refresh';

const sample = {
  current: { temperature_2m: 67.6, weather_code: 2 },
  daily: { time: ['2026-10-14'], weather_code: [0], temperature_2m_max: [72], temperature_2m_min: [55] },
};
const okFetch: FetchFn = async () => ({ ok: true, status: 200, json: async () => sample });
const withLocation = () => {
  const store = createStore(null);
  store.update((s) => {
    s.settings.location = { query: 'Springfield', name: 'Springfield, Illinois', lat: 39.8, lon: -89.6 };
  });
  return store;
};

describe('refreshWeather', () => {
  it('stores a fresh forecast', async () => {
    const store = withLocation();
    expect(await refreshWeather(store, () => 1000, okFetch)).toBe(true);
    expect(store.get().weather?.current.temp).toBe(68);
    expect(store.get().weather?.fetchedAt).toBe(1000);
  });

  it('does nothing without a location', async () => {
    const fetchFn = vi.fn(okFetch);
    expect(await refreshWeather(createStore(null), () => 1, fetchFn)).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('keeps the previous forecast when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = withLocation();
    await refreshWeather(store, () => 1000, okFetch);
    const offline: FetchFn = async () => {
      throw new Error('offline');
    };
    expect(await refreshWeather(store, () => 2000, offline)).toBe(false);
    expect(store.get().weather?.fetchedAt).toBe(1000);
  });

  it('discards a response that arrives after the unit changed', async () => {
    const store = withLocation();
    const racing: FetchFn = async () => {
      store.update((s) => {
        s.settings.unit = 'C';
      });
      return { ok: true, status: 200, json: async () => sample };
    };
    expect(await refreshWeather(store, () => 1, racing)).toBe(false);
    expect(store.get().weather).toBeUndefined();
  });
});
