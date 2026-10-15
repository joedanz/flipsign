import { describe, expect, it } from 'vitest';
import { BLANK_GRID } from '../shared/board/charset';
import { Hub, type HubEvent } from './hub';
import type { View } from './scheduler/scheduler';

const view = (over: Partial<View> = {}): View => ({
  grid: BLANK_GRID,
  mode: 'rotation',
  entryId: 'clock',
  label: 'Clock',
  expiresAt: null,
  nextAt: 60_000,
  ...over,
});
const settings = { flipMs: 70, sound: true };

function watch(hub: Hub) {
  const events: HubEvent[] = [];
  const unsubscribe = hub.subscribe((e) => events.push(e));
  return { events, names: () => events.map((e) => e.event), unsubscribe };
}

describe('Hub', () => {
  it('emits grid and state on the first update', () => {
    const hub = new Hub();
    const w = watch(hub);
    hub.update(view(), settings, 0);
    expect(w.names()).toEqual(['grid', 'state']);
  });

  it('stays quiet when nothing changed (serverNow alone does not count)', () => {
    const hub = new Hub();
    hub.update(view(), settings, 0);
    const w = watch(hub);
    hub.update(view(), settings, 1000);
    expect(w.events).toEqual([]);
  });

  it('emits only grid when just the grid changed', () => {
    const hub = new Hub();
    hub.update(view(), settings, 0);
    const w = watch(hub);
    hub.update(view({ grid: 'A'.padEnd(132, ' ') }), settings, 1000);
    expect(w.names()).toEqual(['grid']);
  });

  it('emits grid when flip speed or sound changes', () => {
    const hub = new Hub();
    hub.update(view(), settings, 0);
    const w = watch(hub);
    hub.update(view(), { flipMs: 100, sound: true }, 1);
    hub.update(view(), { flipMs: 100, sound: false }, 2);
    expect(w.names()).toEqual(['grid', 'grid']);
  });

  it('emits state when the rotation advances or after bump()', () => {
    const hub = new Hub();
    hub.update(view(), settings, 0);
    const w = watch(hub);
    hub.update(view({ entryId: 'weather', label: 'Weather', nextAt: 120_000 }), settings, 1);
    hub.bump();
    hub.update(view({ entryId: 'weather', label: 'Weather', nextAt: 120_000 }), settings, 2);
    expect(w.names()).toEqual(['state', 'state']);
  });

  it('gives new clients the latest grid and state', () => {
    const hub = new Hub();
    expect(hub.snapshot()).toEqual([]);
    hub.update(view(), settings, 5);
    const snap = hub.snapshot();
    expect(snap.map((e) => e.event)).toEqual(['grid', 'state']);
    expect(snap[1]).toMatchObject({ event: 'state', data: { serverNow: 5 } });
  });

  it('stops delivering after unsubscribe and tracks the subscriber count', () => {
    const hub = new Hub();
    const w = watch(hub);
    expect(hub.size).toBe(1);
    w.unsubscribe();
    expect(hub.size).toBe(0);
    hub.update(view(), settings, 0);
    expect(w.events).toEqual([]);
  });

  it('keeps delivering to others when one subscriber throws', () => {
    const hub = new Hub();
    hub.subscribe(() => {
      throw new Error('broken client');
    });
    const w = watch(hub);
    hub.update(view(), settings, 0);
    expect(w.names()).toEqual(['grid', 'state']);
  });
});
