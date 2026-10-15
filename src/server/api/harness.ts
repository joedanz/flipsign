import { Hub } from '../hub';
import { Scheduler } from '../scheduler/scheduler';
import { createStore } from '../store/store';
import { createApp, type AppDeps } from './app';

export function makeApp(overrides: Partial<AppDeps> = {}) {
  let t = new Date(2026, 9, 14, 9, 0, 0).getTime();
  const store = createStore(null);
  const hub = new Hub();
  const scheduler = new Scheduler({ store, now: () => t, rng: () => 0.5 });
  const calls = { weather: 0 };
  const { app, refresh } = createApp({
    store,
    scheduler,
    hub,
    now: () => t,
    geocode: async (q) => (q === 'Nowhere' ? null : { name: 'Springfield, Illinois', lat: 39.8, lon: -89.6 }),
    onWeatherChange: () => {
      calls.weather++;
    },
    ...overrides,
  });
  const json = (path: string, method: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    app,
    store,
    hub,
    scheduler,
    calls,
    json,
    refresh,
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}
