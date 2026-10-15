import { z } from 'zod';

export const ForecastSchema = z.object({
  fetchedAt: z.number(),
  unit: z.enum(['F', 'C']),
  current: z.object({ temp: z.number(), code: z.number() }),
  days: z.array(z.object({ date: z.string(), code: z.number(), high: z.number(), low: z.number() })),
});
export type Forecast = z.infer<typeof ForecastSchema>;
export type Unit = Forecast['unit'];

const ApiResponse = z.object({
  current: z.object({ temperature_2m: z.number(), weather_code: z.number() }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
  }),
});

export function parseForecast(json: unknown, unit: Unit, now: number): Forecast {
  const r = ApiResponse.parse(json);
  return {
    fetchedAt: now,
    unit,
    current: { temp: Math.round(r.current.temperature_2m), code: r.current.weather_code },
    days: r.daily.time.map((date, i) => ({
      date,
      code: r.daily.weather_code[i]!,
      high: Math.round(r.daily.temperature_2m_max[i]!),
      low: Math.round(r.daily.temperature_2m_min[i]!),
    })),
  };
}

export interface Condition {
  label: string;
  color: 'y' | 'w' | 'b' | 'v';
}

/** WMO weather interpretation codes → short board label + accent tile color. */
export function describe(code: number): Condition {
  if (code === 0) return { label: 'CLEAR', color: 'y' };
  if (code === 1) return { label: 'MOSTLY CLEAR', color: 'y' };
  if (code === 2) return { label: 'PARTLY CLOUDY', color: 'w' };
  if (code === 3) return { label: 'CLOUDY', color: 'w' };
  if (code === 45 || code === 48) return { label: 'FOG', color: 'w' };
  if (code >= 51 && code <= 57) return { label: 'DRIZZLE', color: 'b' };
  if (code >= 61 && code <= 67) return { label: 'RAIN', color: 'b' };
  if (code >= 71 && code <= 77) return { label: 'SNOW', color: 'w' };
  if (code >= 80 && code <= 82) return { label: 'SHOWERS', color: 'b' };
  if (code === 85 || code === 86) return { label: 'SNOW SHOWERS', color: 'w' };
  if (code >= 95) return { label: 'STORMS', color: 'v' };
  return { label: 'UNKNOWN', color: 'w' };
}
