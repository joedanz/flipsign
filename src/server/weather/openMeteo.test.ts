import { describe, expect, it } from 'vitest';
import { fetchForecast, geocode, type FetchFn } from './openMeteo';

function fakeFetch(body: unknown, ok = true, status = 200) {
  const calls: string[] = [];
  const fn: FetchFn = async (url) => {
    calls.push(url);
    return { ok, status, json: async () => body };
  };
  return { fn, calls };
}

describe('geocode', () => {
  it('returns the first match with a readable name', async () => {
    const { fn, calls } = fakeFetch({
      results: [{ name: 'New York', admin1: 'New York', latitude: 40.71, longitude: -74.0 }],
    });
    expect(await geocode('New York', fn)).toEqual({ name: 'New York, New York', lat: 40.71, lon: -74.0 });
    expect(calls[0]).toContain('name=New%20York');
  });

  it('returns null when nothing matches', async () => {
    expect(await geocode('Nowhereville', fakeFetch({ generationtime_ms: 1 }).fn)).toBeNull();
  });

  it('throws when the service errors', async () => {
    await expect(geocode('x', fakeFetch({}, false, 500).fn)).rejects.toThrow(/500/);
  });
});

describe('fetchForecast', () => {
  const body = {
    current: { temperature_2m: 50, weather_code: 0 },
    daily: { time: ['2026-10-14'], weather_code: [0], temperature_2m_max: [55], temperature_2m_min: [40] },
  };

  it('asks for Fahrenheit or Celsius', async () => {
    const f = fakeFetch(body);
    await fetchForecast({ lat: 1.5, lon: 2.5 }, 'F', 0, f.fn);
    expect(f.calls[0]).toContain('temperature_unit=fahrenheit');
    expect(f.calls[0]).toContain('latitude=1.5');
    expect(f.calls[0]).toContain('longitude=2.5');
    const c = fakeFetch(body);
    await fetchForecast({ lat: 1, lon: 2 }, 'C', 0, c.fn);
    expect(c.calls[0]).toContain('temperature_unit=celsius');
  });

  it('throws on HTTP errors', async () => {
    await expect(fetchForecast({ lat: 1, lon: 2 }, 'F', 0, fakeFetch({}, false, 503).fn)).rejects.toThrow(/503/);
  });
});
