import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './api/app';
import { Hub } from './hub';
import { Scheduler } from './scheduler/scheduler';
import { createStore } from './store/store';
import { geocode } from './weather/openMeteo';
import { refreshWeather } from './weather/refresh';

const PORT = Number(process.env.PORT ?? 3000);
const DATA_FILE = process.env.FLIPSIGN_DATA ?? join(process.cwd(), 'data', 'state.json');
const WEATHER_EVERY_MS = 15 * 60_000;

const store = createStore(DATA_FILE);
const scheduler = new Scheduler({ store, now: Date.now });
const hub = new Hub();

const safeRefresh = () => {
  try {
    refresh();
  } catch (err) {
    console.error('refresh failed:', err); // keep the process (and the last grid on screen) alive
  }
};

const updateWeather = () => {
  void refreshWeather(store, Date.now).then(safeRefresh);
};

const { app, refresh } = createApp({
  store,
  scheduler,
  hub,
  now: Date.now,
  geocode: (q) => geocode(q),
  onWeatherChange: updateWeather,
  staticRoot: './dist',
});

setInterval(safeRefresh, 1000);
setInterval(updateWeather, WEATHER_EVERY_MS);
updateWeather();

const server = serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`flipsign listening on http://0.0.0.0:${info.port} (state: ${DATA_FILE})`);
});

const shutdown = () => {
  server.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
