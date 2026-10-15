import { describe, expect, it, vi } from 'vitest';
import { gridRows } from '../../shared/board/layout';
import type { HubEvent } from '../hub';
import { makeApp } from './harness';

const rows = (g: string) => gridRows(g).map((r) => r.trim());

describe('POST /api/message', () => {
  it('sets a timed override', async () => {
    const h = makeApp();
    const res = await h.json('/api/message', 'POST', { text: 'HELLO', duration: '15m' });
    expect(res.status).toBe(201);
    expect(h.store.get().override).toMatchObject({ text: 'HELLO', expiresAt: h.now() + 15 * 60_000 });
  });

  it('supports 1h, 4h and until-cleared', async () => {
    const h = makeApp();
    await h.json('/api/message', 'POST', { text: 'A', duration: '1h' });
    expect(h.store.get().override?.expiresAt).toBe(h.now() + 3_600_000);
    await h.json('/api/message', 'POST', { text: 'A', duration: '4h' });
    expect(h.store.get().override?.expiresAt).toBe(h.now() + 4 * 3_600_000);
    await h.json('/api/message', 'POST', { text: 'A', duration: 'forever' });
    expect(h.store.get().override?.expiresAt).toBeNull();
  });

  it('adds to the rotation without an override', async () => {
    const h = makeApp();
    const res = await h.json('/api/message', 'POST', { text: 'HELLO', duration: 'rotation' });
    expect(res.status).toBe(201);
    expect(h.store.get().override).toBeNull();
    expect(h.store.get().rotation.at(-1)).toMatchObject({ kind: 'message', text: 'HELLO', enabled: true });
  });

  it('replaces an existing override', async () => {
    const h = makeApp();
    await h.json('/api/message', 'POST', { text: 'FIRST', duration: '1h' });
    await h.json('/api/message', 'POST', { text: 'SECOND', duration: '1h' });
    expect(h.store.get().override?.text).toBe('SECOND');
  });

  it('rejects text that does not fit on the board', async () => {
    const h = makeApp();
    const res = await h.json('/api/message', 'POST', { text: 'A\nB\nC\nD\nE\nF\nG', duration: '1h' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toContain('G');
    expect(h.store.get().override).toBeNull();
  });

  it('rejects a message with nothing displayable in it (emoji only)', async () => {
    const h = makeApp();
    const res = await h.json('/api/message', 'POST', { text: '🎉🎉', duration: '1h' });
    expect(res.status).toBe(422);
    expect(h.store.get().override).toBeNull();
  });

  it('accepts a message that is only color tiles', async () => {
    const h = makeApp();
    expect((await h.json('/api/message', 'POST', { text: '{red}{blue}', duration: '1h' })).status).toBe(201);
  });

  it('rejects malformed requests', async () => {
    const h = makeApp();
    expect((await h.json('/api/message', 'POST', { text: 'HI' })).status).toBe(400);
    expect((await h.json('/api/message', 'POST', { text: 'HI', duration: 'soon' })).status).toBe(400);
    expect((await h.json('/api/message', 'POST', { text: '', duration: '1h' })).status).toBe(400);
    const bad = await h.app.request('/api/message', { method: 'POST', body: '{nope', headers: { 'content-type': 'application/json' } });
    expect(bad.status).toBe(400);
  });

  it('puts the message on the board and tells subscribers', async () => {
    const h = makeApp();
    const seen: HubEvent[] = [];
    h.hub.subscribe((e) => seen.push(e));
    await h.json('/api/message', 'POST', { text: 'HELLO', duration: '1h' });
    const grid = seen.find((e): e is Extract<HubEvent, { event: 'grid' }> => e.event === 'grid');
    expect(rows(grid!.data.grid).join(' ')).toContain('HELLO');
    expect(seen.some((e) => e.event === 'state')).toBe(true);
  });
});

describe('GET /api/state and override clearing', () => {
  it('reports settings, rotation, override and the current view', async () => {
    const h = makeApp();
    await h.json('/api/message', 'POST', { text: 'HELLO', duration: '1h' });
    const body = (await (await h.json('/api/state', 'GET')).json()) as any;
    expect(body.override.text).toBe('HELLO');
    expect(body.view.mode).toBe('override');
    expect(body.rotation.map((e: any) => e.id)).toEqual(['clock', 'weather', 'quote']);
    expect(body.starterQuoteCount).toBeGreaterThan(40);
    expect(body.serverNow).toBe(h.now());
  });

  it('clears an override, and clearing again is harmless', async () => {
    const h = makeApp();
    await h.json('/api/message', 'POST', { text: 'HELLO', duration: '1h' });
    expect((await h.json('/api/override', 'DELETE')).status).toBe(204);
    expect(h.store.get().override).toBeNull();
    expect((await h.json('/api/override', 'DELETE')).status).toBe(204);
  });
});

describe('rotation routes', () => {
  it('reorders and disables entries', async () => {
    const h = makeApp();
    const res = await h.json('/api/rotation', 'PUT', [
      { id: 'quote', enabled: true },
      { id: 'clock', enabled: false },
      { id: 'weather', enabled: true },
    ]);
    expect(res.status).toBe(200);
    expect(h.store.get().rotation.map((e) => [e.id, e.enabled])).toEqual([
      ['quote', true],
      ['clock', false],
      ['weather', true],
    ]);
  });

  it('rejects an order that drops, adds or repeats ids', async () => {
    const h = makeApp();
    expect((await h.json('/api/rotation', 'PUT', [{ id: 'clock', enabled: true }])).status).toBe(400);
    expect(
      (await h.json('/api/rotation', 'PUT', [
        { id: 'clock', enabled: true },
        { id: 'clock', enabled: true },
        { id: 'weather', enabled: true },
      ])).status,
    ).toBe(400);
  });

  it('deletes rotation messages but not built-in screens', async () => {
    const h = makeApp();
    await h.json('/api/message', 'POST', { text: 'HELLO', duration: 'rotation' });
    const id = h.store.get().rotation.at(-1)!.id;
    expect((await h.json(`/api/rotation/${id}`, 'DELETE')).status).toBe(204);
    expect(h.store.get().rotation).toHaveLength(3);
    expect((await h.json('/api/rotation/clock', 'DELETE')).status).toBe(400);
    expect((await h.json('/api/rotation/nope', 'DELETE')).status).toBe(404);
  });
});

describe('quote routes', () => {
  it('adds and deletes a quote', async () => {
    const h = makeApp();
    const res = await h.json('/api/quotes', 'POST', { text: 'Stay curious.', author: 'Me' });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(h.store.get().quotes).toHaveLength(1);
    expect((await h.json(`/api/quotes/${id}`, 'DELETE')).status).toBe(204);
    expect(h.store.get().quotes).toHaveLength(0);
    expect((await h.json(`/api/quotes/${id}`, 'DELETE')).status).toBe(404);
  });

  it('rejects a quote or author with nothing displayable in it', async () => {
    const h = makeApp();
    expect((await h.json('/api/quotes', 'POST', { text: '😀😀' })).status).toBe(422);
    expect((await h.json('/api/quotes', 'POST', { text: 'Fine words', author: '🎉' })).status).toBe(422);
    expect(h.store.get().quotes).toHaveLength(0);
  });

  it('rejects a quote that cannot fit', async () => {
    const h = makeApp();
    expect((await h.json('/api/quotes', 'POST', { text: 'WORD '.repeat(60), author: 'X' })).status).toBe(422);
    expect(h.store.get().quotes).toHaveLength(0);
  });
});

describe('PUT /api/quotes/enabled', () => {
  it('lists built-in quotes in the state, all active by default', async () => {
    const h = makeApp();
    const body = (await (await h.json('/api/state', 'GET')).json()) as any;
    expect(body.starterQuotes.length).toBe(body.starterQuoteCount);
    expect(body.starterQuotes[0]).toMatchObject({ id: 'starter-0' });
    expect(body.disabledQuotes).toEqual([]);
  });

  it('switches a single built-in or own quote off and on', async () => {
    const h = makeApp();
    const { id } = (await (await h.json('/api/quotes', 'POST', { text: 'Stay curious.' })).json()) as { id: string };
    expect((await h.json('/api/quotes/enabled', 'PUT', { ids: ['starter-3', id], enabled: false })).status).toBe(200);
    expect(h.store.get().disabledQuotes.sort()).toEqual([id, 'starter-3'].sort());
    await h.json('/api/quotes/enabled', 'PUT', { ids: ['starter-3'], enabled: true });
    expect(h.store.get().disabledQuotes).toEqual([id]);
  });

  it('switches everything off or on when no ids are given', async () => {
    const h = makeApp();
    await h.json('/api/quotes', 'POST', { text: 'Mine.' });
    await h.json('/api/quotes/enabled', 'PUT', { enabled: false });
    expect(h.store.get().disabledQuotes).toHaveLength(h.store.get().quotes.length + 54);
    await h.json('/api/quotes/enabled', 'PUT', { enabled: true });
    expect(h.store.get().disabledQuotes).toEqual([]);
  });

  it('rejects unknown ids without changing anything', async () => {
    const h = makeApp();
    expect((await h.json('/api/quotes/enabled', 'PUT', { ids: ['nope'], enabled: false })).status).toBe(404);
    expect((await h.json('/api/quotes/enabled', 'PUT', { ids: ['starter-1'] })).status).toBe(400);
    expect(h.store.get().disabledQuotes).toEqual([]);
  });

  it('forgets a deleted quote and keeps the board updated', async () => {
    const h = makeApp();
    const { id } = (await (await h.json('/api/quotes', 'POST', { text: 'Gone soon.' })).json()) as { id: string };
    await h.json('/api/quotes/enabled', 'PUT', { ids: [id], enabled: false });
    await h.json(`/api/quotes/${id}`, 'DELETE');
    expect(h.store.get().disabledQuotes).toEqual([]);
  });
});

describe('PUT /api/settings', () => {
  it('updates simple settings', async () => {
    const h = makeApp();
    const res = await h.json('/api/settings', 'PUT', { hour12: false, flipMs: 100, sound: false });
    expect(res.status).toBe(200);
    expect(h.store.get().settings).toMatchObject({ hour12: false, flipMs: 100, sound: false });
    expect(h.calls.weather).toBe(0);
  });

  it('geocodes a new location, clears cached weather and asks for a refresh', async () => {
    const h = makeApp();
    h.store.update((s) => {
      s.weather = { fetchedAt: 1, unit: 'F', current: { temp: 1, code: 0 }, days: [] };
    });
    const res = await h.json('/api/settings', 'PUT', { locationQuery: 'Springfield' });
    expect(res.status).toBe(200);
    expect(h.store.get().settings.location).toEqual({ query: 'Springfield', name: 'Springfield, Illinois', lat: 39.8, lon: -89.6 });
    expect(h.store.get().weather).toBeUndefined();
    expect(h.calls.weather).toBe(1);
  });

  it('clears cached weather and refreshes when the unit changes', async () => {
    const h = makeApp();
    h.store.update((s) => {
      s.weather = { fetchedAt: 1, unit: 'F', current: { temp: 1, code: 0 }, days: [] };
    });
    await h.json('/api/settings', 'PUT', { unit: 'C' });
    expect(h.store.get().weather).toBeUndefined();
    expect(h.calls.weather).toBe(1);
  });

  it('rejects an unknown location and leaves settings unchanged', async () => {
    const h = makeApp();
    const before = structuredClone(h.store.get().settings);
    const res = await h.json('/api/settings', 'PUT', { locationQuery: 'Nowhere', hour12: false });
    expect(res.status).toBe(422);
    expect(h.store.get().settings).toEqual(before);
  });

  it('reports a failed lookup as 502', async () => {
    const h = makeApp({
      geocode: async () => {
        throw new Error('offline');
      },
    });
    expect((await h.json('/api/settings', 'PUT', { locationQuery: 'Springfield' })).status).toBe(502);
  });

  it('clears the location with an empty query', async () => {
    const h = makeApp();
    await h.json('/api/settings', 'PUT', { locationQuery: 'Springfield' });
    await h.json('/api/settings', 'PUT', { locationQuery: '' });
    expect(h.store.get().settings.location).toBeUndefined();
  });

  it('rejects out-of-range values', async () => {
    const h = makeApp();
    expect((await h.json('/api/settings', 'PUT', { flipMs: 5 })).status).toBe(400);
    expect((await h.json('/api/settings', 'PUT', { unit: 'K' })).status).toBe(400);
    expect(h.store.get().settings.flipMs).toBe(70);
  });
});

describe('GET /events', () => {
  it('sends the current grid immediately and removes the client on disconnect', async () => {
    const h = makeApp();
    const res = await h.app.request('/events');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain('event: grid');
    expect(h.hub.size).toBe(1);
    await reader.cancel();
    await vi.waitFor(() => expect(h.hub.size).toBe(0));
  });
});

describe('GET /healthz', () => {
  it('answers ok', async () => {
    const h = makeApp();
    const res = await h.json('/healthz', 'GET');
    expect(await res.text()).toBe('ok');
  });
});

describe('limits', () => {
  it('stops accepting quotes after 200 of your own', async () => {
    const h = makeApp();
    h.store.update((s) => {
      for (let i = 0; i < 200; i++) s.quotes.push({ id: `u-${i}`, text: 'X' });
    });
    const res = await h.json('/api/quotes', 'POST', { text: 'One too many' });
    expect(res.status).toBe(422);
    expect(h.store.get().quotes).toHaveLength(200);
  });

  it('stops accepting rotation messages after 50', async () => {
    const h = makeApp();
    h.store.update((s) => {
      for (let i = 0; i < 50; i++) s.rotation.push({ id: `m-${i}`, kind: 'message', enabled: true, text: 'X' });
    });
    const res = await h.json('/api/message', 'POST', { text: 'One too many', duration: 'rotation' });
    expect(res.status).toBe(422);
    expect(h.store.get().rotation.filter((e) => e.kind === 'message')).toHaveLength(50);
  });
});
