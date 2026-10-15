import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultState } from './state';
import { createStore } from './store';

const tmpFile = () => join(mkdtempSync(join(tmpdir(), 'flipsign-')), 'data', 'state.json');
const seed = (file: string, contents: string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
};

describe('createStore', () => {
  it('starts from defaults when there is no file', () => {
    expect(createStore(tmpFile()).get()).toEqual(defaultState());
  });

  it('persists updates and reloads them, including an active override', () => {
    const file = tmpFile();
    const store = createStore(file);
    const override = { text: 'HAPPY BIRTHDAY', createdAt: 1000, expiresAt: 1000 + 4 * 3_600_000 };
    store.update((s) => {
      s.override = override;
      s.settings.unit = 'C';
    });
    const reloaded = createStore(file).get();
    expect(reloaded.override).toEqual(override);
    expect(reloaded.settings.unit).toBe('C');
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });

  it('moves an unparseable file aside and starts from defaults', () => {
    const file = tmpFile();
    seed(file, '{nope');
    expect(createStore(file).get()).toEqual(defaultState());
    expect(existsSync(`${file}.bak`)).toBe(true);
    expect(existsSync(file)).toBe(false);
  });

  it('moves a wrong-shaped file aside too', () => {
    const file = tmpFile();
    seed(file, JSON.stringify({ version: 1, settings: { unit: 'K' } }));
    expect(createStore(file).get()).toEqual(defaultState());
    expect(existsSync(`${file}.bak`)).toBe(true);
  });

  it('keeps the first backup when the file is corrupted again', () => {
    const file = tmpFile();
    seed(file, '{first');
    createStore(file);
    seed(file, '{second');
    createStore(file);
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('{first');
    expect(readdirSync(dirname(file)).filter((f) => f.includes('.bak'))).toHaveLength(2);
  });

  it('rejects an invalid update and keeps the previous state', () => {
    const file = tmpFile();
    const store = createStore(file);
    expect(() =>
      store.update((s) => {
        s.settings.flipMs = 5; // below the allowed minimum
      }),
    ).toThrow();
    expect(store.get().settings.flipMs).toBe(70);
    expect(existsSync(file)).toBe(false);
  });

  it('returns the new state from update', () => {
    const store = createStore(null);
    expect(store.update((s) => (s.settings.sound = false)).settings.sound).toBe(false);
  });

  it('works in memory without touching the file system', () => {
    const store = createStore(null);
    store.update((s) => {
      s.settings.hour12 = false;
    });
    expect(store.get().settings.hour12).toBe(false);
  });

  it('loads a state file saved before quote toggles existed', () => {
    const file = tmpFile();
    const { disabledQuotes: _omit, ...legacy } = defaultState();
    seed(file, JSON.stringify({ ...legacy, settings: { ...legacy.settings, useStarterQuotes: true } }));
    expect(createStore(file).get().disabledQuotes).toEqual([]);
    expect(existsSync(`${file}.bak`)).toBe(false);
  });

  it('ships a default rotation of clock, weather, quote', () => {
    expect(defaultState().rotation.map((e) => e.kind)).toEqual(['clock', 'weather', 'quote']);
  });
});
