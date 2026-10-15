import { describe, expect, it } from 'vitest';
import { gridRows } from '../../shared/board/layout';
import { STARTER_QUOTES } from '../screens/starterQuotes';
import { createStore } from '../store/store';
import type { Forecast } from '../weather/forecast';
import { Scheduler } from './scheduler';

const rows = (g: string) => gridRows(g).map((r) => r.trim());
const text = (g: string) => rows(g).join(' ');

function setup() {
  let t = new Date(2026, 9, 14, 9, 0, 0).getTime();
  const store = createStore(null);
  const sched = new Scheduler({ store, now: () => t, rng: () => 0.5 });
  const forecast = (): Forecast => ({
    fetchedAt: t,
    unit: 'F',
    current: { temp: 68, code: 0 },
    days: [{ date: '2026-10-14', code: 0, high: 72, low: 55 }],
  });
  return {
    store,
    sched,
    forecast,
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}
const SLOT = 60_000;

describe('rotation', () => {
  it('starts on the clock', () => {
    const s = setup();
    const v = s.sched.tick();
    expect(v.mode).toBe('rotation');
    expect(v.entryId).toBe('clock');
    expect(text(v.grid)).toContain('WEDNESDAY');
  });

  it('cycles clock → weather → quote → clock every 60 seconds', () => {
    const s = setup();
    const ids: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(s.sched.tick().entryId);
      s.advance(SLOT);
    }
    expect(ids).toEqual(['clock', 'weather', 'quote', 'clock']);
  });

  it('does not advance early and reports when it will', () => {
    const s = setup();
    const start = s.now();
    expect(s.sched.tick().nextAt).toBe(start + SLOT);
    s.advance(SLOT - 1);
    expect(s.sched.tick().entryId).toBe('clock');
  });

  it('shows the set-location notice when weather has no location', () => {
    const s = setup();
    s.sched.tick();
    s.advance(SLOT);
    expect(text(s.sched.tick().grid)).toContain('SET LOCATION');
  });

  it('skips weather when a location is set but no forecast exists yet', () => {
    const s = setup();
    s.store.update((st) => {
      st.settings.location = { query: 'x', name: 'X', lat: 1, lon: 2 };
    });
    s.sched.tick();
    s.advance(SLOT);
    expect(s.sched.tick().entryId).toBe('quote');
  });

  it('shows the forecast once it exists', () => {
    const s = setup();
    s.store.update((st) => {
      st.settings.location = { query: 'x', name: 'X', lat: 1, lon: 2 };
      st.weather = s.forecast();
    });
    s.sched.tick();
    s.advance(SLOT);
    const v = s.sched.tick();
    expect(v.entryId).toBe('weather');
    expect(text(v.grid)).toContain('68°');
  });

  it('keeps one quote for its whole slot and picks a different one next time', () => {
    const s = setup();
    s.advance(0);
    s.sched.tick(); // clock
    s.advance(SLOT);
    s.sched.tick(); // weather
    s.advance(SLOT);
    const first = s.sched.tick();
    s.advance(10_000);
    expect(s.sched.tick().grid).toBe(first.grid);
    s.advance(SLOT * 2 - 10_000); // → clock, weather, quote again
    s.sched.tick();
    s.advance(SLOT);
    s.sched.tick();
    s.advance(SLOT);
    const second = s.sched.tick();
    expect(second.entryId).toBe('quote');
    expect(second.grid).not.toBe(first.grid);
  });

  it('never shows a quote that has been switched off', () => {
    const s = setup();
    s.store.update((st) => {
      st.quotes = [
        { id: 'u-a', text: 'KEEP ME' },
        { id: 'u-b', text: 'NOT ME' },
      ];
      st.disabledQuotes = ['u-b', ...STARTER_QUOTES.map((q) => q.id)];
    });
    const shown = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const v = s.sched.tick();
      if (v.entryId === 'quote') shown.add(text(v.grid).trim());
      s.advance(SLOT);
    }
    expect([...shown]).toEqual(['KEEP ME']);
  });

  it('skips the quote screen when every quote is switched off', () => {
    const s = setup();
    s.store.update((st) => {
      st.disabledQuotes = STARTER_QUOTES.map((q) => q.id);
    });
    const ids: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(s.sched.tick().entryId);
      s.advance(SLOT);
    }
    expect(ids).toEqual(['clock', 'weather', 'clock', 'weather']);
  });

  it('includes enabled rotation messages', () => {
    const s = setup();
    s.store.update((st) => {
      st.rotation.push({ id: 'm1', kind: 'message', enabled: true, text: 'HELLO THERE' });
    });
    const ids: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(s.sched.tick().entryId);
      s.advance(SLOT);
    }
    expect(ids).toEqual(['clock', 'weather', 'quote', 'm1']);
  });

  it('skips disabled entries', () => {
    const s = setup();
    s.store.update((st) => {
      st.rotation.find((e) => e.id === 'weather')!.enabled = false;
    });
    s.sched.tick();
    s.advance(SLOT);
    expect(s.sched.tick().entryId).toBe('quote');
  });

  it('moves on when the entry being shown gets disabled', () => {
    const s = setup();
    s.sched.tick();
    s.advance(SLOT);
    expect(s.sched.tick().entryId).toBe('weather');
    s.store.update((st) => {
      st.rotation.find((e) => e.id === 'weather')!.enabled = false;
    });
    expect(s.sched.tick().entryId).toBe('quote');
  });

  it('falls back to the clock when every entry is disabled', () => {
    const s = setup();
    s.store.update((st) => {
      st.rotation.forEach((e) => (e.enabled = false));
    });
    const v = s.sched.tick();
    expect(v.entryId).toBeNull();
    expect(text(v.grid)).toContain('WEDNESDAY');
  });

  it('falls back to the clock when only weather is enabled and it has no data', () => {
    const s = setup();
    s.store.update((st) => {
      st.rotation.forEach((e) => (e.enabled = e.kind === 'weather'));
      st.settings.location = { query: 'x', name: 'X', lat: 1, lon: 2 };
    });
    const v = s.sched.tick();
    expect(v.entryId).toBeNull();
    expect(text(v.grid)).toContain('WEDNESDAY');
  });
});

describe('override', () => {
  const setOverride = (s: ReturnType<typeof setup>, ms: number | null) =>
    s.store.update((st) => {
      st.override = { text: 'HELLO', createdAt: s.now(), expiresAt: ms === null ? null : s.now() + ms };
    });

  it('beats the rotation and reports its expiry', () => {
    const s = setup();
    setOverride(s, 15 * 60_000);
    const v = s.sched.tick();
    expect(v.mode).toBe('override');
    expect(text(v.grid)).toContain('HELLO');
    expect(v.expiresAt).toBe(s.now() + 15 * 60_000);
    expect(v.nextAt).toBeNull();
  });

  it('expires, clears itself from the store, and returns to rotation', () => {
    const s = setup();
    setOverride(s, 15 * 60_000);
    s.advance(15 * 60_000);
    expect(s.sched.tick().mode).toBe('rotation');
    expect(s.store.get().override).toBeNull();
  });

  it('never expires when set to until-cleared', () => {
    const s = setup();
    setOverride(s, null);
    s.advance(30 * 24 * 3_600_000);
    expect(s.sched.tick().mode).toBe('override');
  });

  it('resumes the rotation where it left off with a fresh timer', () => {
    const s = setup();
    s.sched.tick(); // clock
    s.advance(SLOT);
    expect(s.sched.tick().entryId).toBe('weather');
    s.advance(10_000);
    setOverride(s, 15 * 60_000);
    s.sched.tick();
    s.advance(15 * 60_000);
    const v = s.sched.tick();
    expect(v.entryId).toBe('weather');
    expect(v.nextAt).toBe(s.now() + SLOT);
  });

  it('is cleared, not shown, when it expired while the server was down', () => {
    const s = setup();
    s.store.update((st) => {
      st.override = { text: 'OLD NEWS', createdAt: s.now() - 10_000, expiresAt: s.now() - 1 };
    });
    const fresh = new Scheduler({ store: s.store, now: s.now, rng: () => 0.5 });
    const v = fresh.tick();
    expect(v.mode).toBe('rotation');
    expect(text(v.grid)).not.toContain('OLD NEWS');
    expect(s.store.get().override).toBeNull();
  });

  it('shows the rotation (and does not throw) when clearing an expired override fails to save', () => {
    const s = setup();
    s.store.update((st) => {
      st.override = { text: 'OLD NEWS', createdAt: s.now() - 10_000, expiresAt: s.now() - 1 };
    });
    const failing = { get: s.store.get, update: () => { throw new Error('disk full'); } };
    const sched = new Scheduler({ store: failing, now: s.now, rng: () => 0.5 });
    const v = sched.tick();
    expect(v.mode).toBe('rotation');
    expect(text(v.grid)).not.toContain('OLD NEWS');
  });

  it('still shows an unexpired override after a restart', () => {
    const s = setup();
    setOverride(s, 4 * 3_600_000);
    const restarted = new Scheduler({ store: s.store, now: s.now, rng: () => 0.5 });
    expect(restarted.tick().mode).toBe('override');
  });
});
