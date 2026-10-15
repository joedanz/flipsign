import { randomUUID } from 'node:crypto';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { isBlankGrid, layoutText } from '../../shared/board/layout';
import type { Hub, HubEvent } from '../hub';
import type { Scheduler } from '../scheduler/scheduler';
import { layoutQuote } from '../screens/quote';
import { STARTER_QUOTES } from '../screens/starterQuotes';
import { SettingsSchema, type Settings } from '../store/state';
import type { Store } from '../store/store';
import type { Place } from '../weather/openMeteo';

export interface AppDeps {
  store: Store;
  scheduler: Scheduler;
  hub: Hub;
  now: () => number;
  geocode: (query: string) => Promise<Place | null>;
  /** Called after the weather location or unit changed so a refresh can be kicked off. */
  onWeatherChange: () => void;
  /** Directory of built web pages (omitted in tests). */
  staticRoot?: string;
}

const DURATION_MS = { '15m': 15 * 60_000, '1h': 3_600_000, '4h': 4 * 3_600_000 } as const;

const MessageBody = z.object({
  text: z.string().min(1).max(500),
  duration: z.enum(['15m', '1h', '4h', 'forever', 'rotation']),
});
const QuoteBody = z.object({ text: z.string().min(1).max(300), author: z.string().max(40).optional() });
const QuoteEnabledBody = z.object({ enabled: z.boolean(), ids: z.array(z.string()).optional() });
const RotationBody = z.array(z.object({ id: z.string(), enabled: z.boolean() }));
const SettingsPatch = SettingsSchema.omit({ location: true })
  .partial()
  .extend({ locationQuery: z.string().max(100).optional() });

const MAX_QUOTES = 200;
const MAX_ROTATION_MESSAGES = 50;

const weatherInputsChanged = (a: Settings, b: Settings) =>
  a.unit !== b.unit || a.location?.lat !== b.location?.lat || a.location?.lon !== b.location?.lon;

const readJson = (req: { json(): Promise<unknown> }) => req.json().catch(() => null);

export function createApp(deps: AppDeps) {
  const { store, scheduler, hub, now } = deps;
  const app = new Hono();

  const refresh = () => hub.update(scheduler.tick(), store.get().settings, now());
  const changed = () => {
    hub.bump();
    refresh();
  };

  app.get('/healthz', (c) => c.text('ok'));

  app.get('/api/state', (c) => {
    const view = scheduler.tick();
    const s = store.get();
    return c.json({
      settings: s.settings,
      rotation: s.rotation,
      quotes: s.quotes,
      starterQuoteCount: STARTER_QUOTES.length,
      starterQuotes: STARTER_QUOTES,
      disabledQuotes: s.disabledQuotes,
      override: s.override,
      view,
      serverNow: now(),
    });
  });

  app.post('/api/message', async (c) => {
    const body = MessageBody.safeParse(await readJson(c.req));
    if (!body.success) return c.json({ error: 'Invalid message' }, 400);
    const { text, duration } = body.data;
    const layout = layoutText(text);
    if (!layout.ok) return c.json({ error: `Doesn't fit on the board: "${layout.overflow}"` }, 422);
    if (isBlankGrid(layout.grid)) return c.json({ error: 'Nothing to show: no supported characters in that message' }, 422);
    if (duration === 'rotation' && store.get().rotation.filter((e) => e.kind === 'message').length >= MAX_ROTATION_MESSAGES) {
      return c.json({ error: `The rotation already has ${MAX_ROTATION_MESSAGES} messages; delete some first` }, 422);
    }
    const t = now();
    store.update((s) => {
      if (duration === 'rotation') {
        s.rotation.push({ id: `m-${randomUUID()}`, kind: 'message', enabled: true, text });
      } else {
        s.override = { text, createdAt: t, expiresAt: duration === 'forever' ? null : t + DURATION_MS[duration] };
      }
    });
    changed();
    return c.json({ ok: true }, 201);
  });

  app.delete('/api/override', (c) => {
    if (store.get().override) {
      store.update((s) => {
        s.override = null;
      });
      changed();
    }
    return c.body(null, 204);
  });

  app.put('/api/rotation', async (c) => {
    const body = RotationBody.safeParse(await readJson(c.req));
    if (!body.success) return c.json({ error: 'Invalid rotation' }, 400);
    const byId = new Map(store.get().rotation.map((e) => [e.id, e]));
    const ids = new Set(body.data.map((b) => b.id));
    if (body.data.length !== byId.size || ids.size !== byId.size || body.data.some((b) => !byId.has(b.id))) {
      return c.json({ error: 'Rotation must list every existing entry exactly once' }, 400);
    }
    store.update((s) => {
      s.rotation = body.data.map((b) => ({ ...byId.get(b.id)!, enabled: b.enabled }));
    });
    changed();
    return c.json({ ok: true });
  });

  app.delete('/api/rotation/:id', (c) => {
    const entry = store.get().rotation.find((e) => e.id === c.req.param('id'));
    if (!entry) return c.json({ error: 'No such rotation entry' }, 404);
    if (entry.kind !== 'message') return c.json({ error: 'Built-in screens can be disabled, not deleted' }, 400);
    store.update((s) => {
      s.rotation = s.rotation.filter((e) => e.id !== entry.id);
    });
    changed();
    return c.body(null, 204);
  });

  app.post('/api/quotes', async (c) => {
    const body = QuoteBody.safeParse(await readJson(c.req));
    if (!body.success) return c.json({ error: 'Invalid quote' }, 400);
    const layout = layoutQuote(body.data);
    if (!layout.ok) return c.json({ error: `Doesn't fit on the board: "${layout.overflow}"` }, 422);
    const blank = (s: string) => {
      const r = layoutText(s);
      return r.ok && isBlankGrid(r.grid);
    };
    if (blank(body.data.text) || (body.data.author && blank(body.data.author))) {
      return c.json({ error: 'Nothing to show: no supported characters in that quote or author' }, 422);
    }
    if (store.get().quotes.length >= MAX_QUOTES) {
      return c.json({ error: `You already have ${MAX_QUOTES} quotes; delete some first` }, 422);
    }
    const quote = { id: `u-${randomUUID()}`, text: body.data.text, author: body.data.author || undefined };
    store.update((s) => {
      s.quotes.push(quote);
    });
    changed();
    return c.json(quote, 201);
  });

  app.put('/api/quotes/enabled', async (c) => {
    const body = QuoteEnabledBody.safeParse(await readJson(c.req));
    if (!body.success) return c.json({ error: 'Invalid request' }, 400);
    const known = new Set([...STARTER_QUOTES, ...store.get().quotes].map((q) => q.id));
    const ids = body.data.ids ?? [...known];
    if (ids.some((id) => !known.has(id))) return c.json({ error: 'No such quote' }, 404);
    store.update((s) => {
      const off = new Set(s.disabledQuotes);
      for (const id of ids) {
        if (body.data.enabled) off.delete(id);
        else off.add(id);
      }
      s.disabledQuotes = [...off];
    });
    changed();
    return c.json({ ok: true });
  });

  app.delete('/api/quotes/:id', (c) => {
    const id = c.req.param('id');
    if (!store.get().quotes.some((q) => q.id === id)) return c.json({ error: 'No such quote' }, 404);
    store.update((s) => {
      s.quotes = s.quotes.filter((q) => q.id !== id);
      s.disabledQuotes = s.disabledQuotes.filter((d) => d !== id);
    });
    changed();
    return c.body(null, 204);
  });

  app.put('/api/settings', async (c) => {
    const patch = SettingsPatch.safeParse(await readJson(c.req));
    if (!patch.success) return c.json({ error: 'Invalid settings' }, 400);
    const { locationQuery, ...rest } = patch.data;

    let place: Place | null | undefined; // undefined = leave alone, null = clear
    if (locationQuery !== undefined) {
      const query = locationQuery.trim();
      if (query === '') place = null;
      else {
        try {
          place = await deps.geocode(query);
        } catch {
          return c.json({ error: 'Location lookup failed, please try again' }, 502);
        }
        if (!place) return c.json({ error: `Couldn't find "${query}"` }, 422);
      }
    }

    const before = store.get().settings;
    store.update((s) => {
      Object.assign(s.settings, rest);
      if (place === null) s.settings.location = undefined;
      else if (place) s.settings.location = { query: locationQuery!.trim(), ...place };
      if (weatherInputsChanged(before, s.settings)) s.weather = undefined;
    });
    const after = store.get().settings;
    const weatherChanged = weatherInputsChanged(before, after);
    changed();
    if (weatherChanged) deps.onWeatherChange();
    return c.json(after);
  });

  app.get('/events', (c) =>
    streamSSE(c, async (stream) => {
      // Serialize writes so the snapshot can never be overtaken by a newer event.
      let chain: Promise<unknown> = Promise.resolve();
      const send = (e: HubEvent) => {
        chain = chain
          .then(() => stream.writeSSE({ event: e.event, data: JSON.stringify(e.data) }))
          .catch(() => {});
      };
      hub.snapshot().forEach(send);
      const unsubscribe = hub.subscribe(send);
      const aborted = new Promise<void>((resolve) => stream.onAbort(resolve));
      stream.onAbort(unsubscribe);
      while (!stream.aborted) {
        await Promise.race([stream.sleep(15_000), aborted]);
        if (!stream.aborted) await stream.writeSSE({ event: 'ping', data: '' }).catch(() => {});
      }
    }),
  );

  if (deps.staticRoot) {
    app.get('/control', (c) => c.redirect('/control/'));
    app.use('/*', serveStatic({ root: deps.staticRoot }));
  }

  refresh();
  return { app, refresh };
}
