import { BLANK_GRID, type Grid } from '../../shared/board/charset';
import { layoutText } from '../../shared/board/layout';
import { renderClock } from '../screens/clock';
import { QuoteDeck, layoutQuote, type Quote } from '../screens/quote';
import { STARTER_QUOTES } from '../screens/starterQuotes';
import { renderWeather, renderWeatherSetup } from '../screens/weather';
import type { RotationEntry, State } from '../store/state';
import type { Store } from '../store/store';

export interface View {
  grid: Grid;
  mode: 'override' | 'rotation';
  /** Rotation entry being shown; null for an override or the empty-rotation clock fallback. */
  entryId: string | null;
  label: string;
  /** Epoch ms when an active override ends; null if none or until-cleared. */
  expiresAt: number | null;
  /** Epoch ms when the rotation advances; null in override mode. */
  nextAt: number | null;
}

export interface SchedulerDeps {
  store: Store;
  now: () => number;
  rng?: () => number;
}

interface Current {
  id: string;
  /** null while an override is active; reset to "now" when rotation resumes. */
  startedAt: number | null;
  quote?: Quote;
}

const LABELS: Record<RotationEntry['kind'], string> = {
  clock: 'Clock',
  weather: 'Weather',
  quote: 'Quote',
  message: 'Message',
};

const gridOrBlank = (r: ReturnType<typeof layoutText>): Grid => (r.ok ? r.grid : BLANK_GRID);

export class Scheduler {
  private current: Current | undefined;
  private lastIndex = 0;
  private readonly deck: QuoteDeck;

  constructor(private readonly deps: SchedulerDeps) {
    this.deck = new QuoteDeck(deps.rng);
  }

  tick(): View {
    const { store } = this.deps;
    const now = this.deps.now();
    let state = store.get();
    const ov = state.override;
    if (ov && (ov.expiresAt === null || now < ov.expiresAt)) {
      if (this.current) this.current.startedAt = null;
      return {
        grid: gridOrBlank(layoutText(ov.text)),
        mode: 'override',
        entryId: null,
        label: 'Message',
        expiresAt: ov.expiresAt,
        nextAt: null,
      };
    }
    if (ov) {
      try {
        state = store.update((s) => {
          s.override = null;
        });
      } catch (err) {
        // Can't persist the clear (e.g. disk full): still stop showing the expired message.
        console.error('could not clear expired override:', err);
        state = { ...state, override: null };
      }
    }
    return this.rotation(state, now);
  }

  private rotation(state: State, now: number): View {
    const entries = state.rotation.filter((e) => this.available(state, e));
    const slotMs = state.settings.secondsPerScreen * 1000;

    if (entries.length === 0) {
      this.current = undefined;
      return {
        grid: renderClock(new Date(now), state.settings.hour12),
        mode: 'rotation',
        entryId: null,
        label: LABELS.clock,
        expiresAt: null,
        nextAt: null,
      };
    }

    let cur = this.current;
    const curId = cur?.id;
    let idx = curId ? entries.findIndex((e) => e.id === curId) : -1;
    if (!cur || idx < 0) {
      // First run, or the entry we were showing was removed/disabled: take whatever now sits at that position.
      idx = Math.min(this.lastIndex, entries.length - 1);
      cur = this.enter(entries[idx]!, state, now);
    } else if (cur.startedAt === null) {
      cur.startedAt = now; // resuming after an override
    } else if (now - cur.startedAt >= slotMs) {
      idx = (idx + 1) % entries.length;
      cur = this.enter(entries[idx]!, state, now);
    }
    this.current = cur;
    this.lastIndex = idx;

    const entry = entries[idx]!;
    return {
      grid: this.render(entry, cur, state, now),
      mode: 'rotation',
      entryId: entry.id,
      label: LABELS[entry.kind],
      expiresAt: null,
      nextAt: cur.startedAt! + slotMs,
    };
  }

  private enter(entry: RotationEntry, state: State, now: number): Current {
    return {
      id: entry.id,
      startedAt: now,
      quote: entry.kind === 'quote' ? this.deck.next(this.quotePool(state)) : undefined,
    };
  }

  private quotePool(state: State): Quote[] {
    const off = new Set(state.disabledQuotes);
    return [...STARTER_QUOTES, ...state.quotes].filter((q) => !off.has(q.id));
  }

  private available(state: State, entry: RotationEntry): boolean {
    if (!entry.enabled) return false;
    switch (entry.kind) {
      case 'clock':
        return true;
      case 'weather':
        return !state.settings.location || !!state.weather;
      case 'quote':
        return this.quotePool(state).length > 0;
      case 'message':
        return !!entry.text;
    }
  }

  private render(entry: RotationEntry, cur: Current, state: State, now: number): Grid {
    switch (entry.kind) {
      case 'clock':
        return renderClock(new Date(now), state.settings.hour12);
      case 'weather':
        return state.settings.location && state.weather ? renderWeather(state.weather, now) : renderWeatherSetup();
      case 'quote':
        return cur.quote ? gridOrBlank(layoutQuote(cur.quote)) : BLANK_GRID;
      case 'message':
        return gridOrBlank(layoutText(entry.text ?? ''));
    }
  }
}
