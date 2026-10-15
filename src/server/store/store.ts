import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { StateSchema, defaultState, type State } from './state';

export interface Store {
  /** The live state. Do not mutate it; use update(). */
  get(): State;
  /** Apply `mutate` to a copy, validate, persist, then swap. Throws (and keeps the old state) on failure. */
  update(mutate: (draft: State) => void): State;
}

function load(file: string): State {
  if (!existsSync(file)) return defaultState();
  try {
    return StateSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch (err) {
    // Never overwrite an earlier backup: it may be the only copy of good data.
    let backup = `${file}.bak`;
    if (existsSync(backup)) backup = `${backup}.${Date.now()}`;
    try {
      renameSync(file, backup);
      console.error(`state file unreadable; moved to ${backup} and starting from defaults:`, err);
    } catch (moveErr) {
      console.error('state file unreadable and could not be moved aside; starting from defaults:', err, moveErr);
    }
    return defaultState();
  }
}

function save(file: string, state: State): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, JSON.stringify(state, null, 2));
    fsyncSync(fd); // make sure the bytes are on disk before the rename publishes them
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
}

/** `file === null` keeps everything in memory (tests). */
export function createStore(file: string | null): Store {
  let state = file ? load(file) : defaultState();
  return {
    get: () => state,
    update(mutate) {
      const draft = structuredClone(state);
      mutate(draft);
      const next = StateSchema.parse(draft);
      if (file) save(file, next);
      state = next;
      return state;
    },
  };
}
