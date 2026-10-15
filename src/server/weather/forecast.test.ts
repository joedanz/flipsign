import { describe, expect, it } from 'vitest';
import { describe as describeWeather, parseForecast } from './forecast';

const sample = {
  current: { temperature_2m: 67.6, weather_code: 2 },
  daily: {
    time: ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'],
    weather_code: [0, 61, 3, 71],
    temperature_2m_max: [72.4, 70.1, 68.5, 65],
    temperature_2m_min: [55.2, 52, 50.5, 48],
  },
};

describe('parseForecast', () => {
  it('rounds temperatures and maps days', () => {
    const f = parseForecast(sample, 'F', 1000);
    expect(f.fetchedAt).toBe(1000);
    expect(f.unit).toBe('F');
    expect(f.current).toEqual({ temp: 68, code: 2 });
    expect(f.days[0]).toEqual({ date: '2026-10-14', code: 0, high: 72, low: 55 });
    expect(f.days[2]).toEqual({ date: '2026-10-16', code: 3, high: 69, low: 51 });
  });

  it('throws on a malformed response', () => {
    expect(() => parseForecast({ current: {} }, 'F', 0)).toThrow();
  });
});

describe('describe(weather code)', () => {
  it('maps WMO codes to a label and a tile color', () => {
    expect(describeWeather(0)).toEqual({ label: 'CLEAR', color: 'y' });
    expect(describeWeather(3)).toEqual({ label: 'CLOUDY', color: 'w' });
    expect(describeWeather(63)).toEqual({ label: 'RAIN', color: 'b' });
    expect(describeWeather(81)).toEqual({ label: 'SHOWERS', color: 'b' });
    expect(describeWeather(73)).toEqual({ label: 'SNOW', color: 'w' });
    expect(describeWeather(95)).toEqual({ label: 'STORMS', color: 'v' });
    expect(describeWeather(999).label).toBe('STORMS'); // >= 95 is treated as a storm
  });

  it('has a fallback for unknown codes', () => {
    expect(describeWeather(-1).label).toBe('UNKNOWN');
  });
});
