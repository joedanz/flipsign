import { z } from 'zod';
import { ForecastSchema } from '../weather/forecast';

export const SettingsSchema = z.object({
  location: z.object({ query: z.string(), name: z.string(), lat: z.number(), lon: z.number() }).optional(),
  unit: z.enum(['F', 'C']),
  hour12: z.boolean(),
  sound: z.boolean(),
  flipMs: z.number().int().min(30).max(300),
  secondsPerScreen: z.number().int().min(5).max(3600),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const RotationEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(['clock', 'weather', 'quote', 'message']),
  enabled: z.boolean(),
  text: z.string().optional(),
});
export type RotationEntry = z.infer<typeof RotationEntrySchema>;

export const QuoteSchema = z.object({ id: z.string(), text: z.string(), author: z.string().optional() });
export type StoredQuote = z.infer<typeof QuoteSchema>;

export const OverrideSchema = z.object({
  text: z.string(),
  createdAt: z.number(),
  expiresAt: z.number().nullable(),
});
export type Override = z.infer<typeof OverrideSchema>;

export const StateSchema = z.object({
  version: z.literal(1),
  settings: SettingsSchema,
  quotes: z.array(QuoteSchema),
  /** Ids (built-in or own) of quotes switched off; everything else is active. */
  disabledQuotes: z.array(z.string()).default([]),
  rotation: z.array(RotationEntrySchema),
  override: OverrideSchema.nullable(),
  weather: ForecastSchema.optional(),
});
export type State = z.infer<typeof StateSchema>;

export function defaultState(): State {
  return {
    version: 1,
    settings: { unit: 'F', hour12: true, sound: true, flipMs: 70, secondsPerScreen: 60 },
    quotes: [],
    disabledQuotes: [],
    rotation: [
      { id: 'clock', kind: 'clock', enabled: true },
      { id: 'weather', kind: 'weather', enabled: true },
      { id: 'quote', kind: 'quote', enabled: true },
    ],
    override: null,
  };
}
