import { describe, expect, it } from 'vitest';
import { gridRows } from '../../shared/board/layout';
import type { Forecast } from '../weather/forecast';
import { renderWeather, renderWeatherSetup } from './weather';

const NOW = new Date(2026, 9, 14, 12, 0, 0).getTime();
const forecast: Forecast = {
  fetchedAt: NOW,
  unit: 'F',
  current: { temp: 68, code: 0 },
  days: [
    { date: '2026-10-14', code: 0, high: 72, low: 55 },
    { date: '2026-10-15', code: 61, high: 70, low: 52 },
    { date: '2026-10-16', code: 3, high: 68, low: 50 },
    { date: '2026-10-17', code: 71, high: 65, low: 48 },
  ],
};
const rows = (g: string) => gridRows(g).map((r) => r.trim());

describe('renderWeather', () => {
  it('shows current conditions, today hi/lo and a 3-day outlook', () => {
    expect(rows(renderWeather(forecast, NOW))).toEqual([
      '',
      '',
      '',
      'y 68° CLEAR y',
      'HI 72  LO 55',
      '',
      'THU    FRI    SAT',
      '70/52  68/50  65/48',
      '',
      '',
    ]);
  });

  it('adds an age marker once the data is two hours old', () => {
    expect(rows(renderWeather(forecast, NOW + 3 * 3_600_000))[2]).toBe('AS OF 3H AGO');
    expect(rows(renderWeather(forecast, NOW + 1 * 3_600_000))[2]).toBe('');
  });

  it('moves HI/LO to the current day once the forecast is a day old', () => {
    const r = rows(renderWeather(forecast, NOW + 24 * 3_600_000));
    expect(r[4]).toBe('HI 70  LO 52');
    expect(r[7]).toBe('68/50  65/48');
  });

  it('leaves out HI/LO when every forecast day is in the past', () => {
    expect(rows(renderWeather(forecast, NOW + 5 * 24 * 3_600_000)).join('|')).not.toContain('HI ');
  });

  it('drops the color accents when the headline would not fit', () => {
    const long: Forecast = { ...forecast, current: { temp: -100, code: 2 } };
    expect(rows(renderWeather(long, NOW))[3]).toBe('-100° PARTLY CLOUDY');
  });
});

describe('renderWeatherSetup', () => {
  it('tells the user to set a location', () => {
    expect(rows(renderWeatherSetup()).join(' ')).toContain('SET LOCATION');
  });
});
