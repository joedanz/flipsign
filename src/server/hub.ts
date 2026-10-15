import type { Grid } from '../shared/board/charset';
import type { View } from './scheduler/scheduler';

export interface GridEvent {
  grid: Grid;
  flipMs: number;
  sound: boolean;
}

export interface StatusEvent {
  rev: number;
  serverNow: number;
  mode: View['mode'];
  label: string;
  expiresAt: number | null;
  nextAt: number | null;
}

export type HubEvent = { event: 'grid'; data: GridEvent } | { event: 'state'; data: StatusEvent };

/** Fan-out of board changes to connected SSE clients, de-duplicated. */
export class Hub {
  private readonly subs = new Set<(e: HubEvent) => void>();
  private grid: GridEvent | undefined;
  private status: StatusEvent | undefined;
  private rev = 0;

  get size(): number {
    return this.subs.size;
  }

  /** Mark that something client-visible changed (settings, rotation, quotes, override). */
  bump(): void {
    this.rev++;
  }

  update(view: View, settings: { flipMs: number; sound: boolean }, now: number): void {
    const grid: GridEvent = { grid: view.grid, flipMs: settings.flipMs, sound: settings.sound };
    const g = this.grid;
    if (!g || g.grid !== grid.grid || g.flipMs !== grid.flipMs || g.sound !== grid.sound) {
      this.grid = grid;
      this.emit({ event: 'grid', data: grid });
    }

    const status: StatusEvent = {
      rev: this.rev,
      serverNow: now,
      mode: view.mode,
      label: view.label,
      expiresAt: view.expiresAt,
      nextAt: view.nextAt,
    };
    const p = this.status;
    if (
      !p ||
      p.rev !== status.rev ||
      p.mode !== status.mode ||
      p.label !== status.label ||
      p.expiresAt !== status.expiresAt ||
      p.nextAt !== status.nextAt
    ) {
      this.status = status;
      this.emit({ event: 'state', data: status });
    } else {
      this.status = { ...p, serverNow: now };
    }
  }

  snapshot(): HubEvent[] {
    const out: HubEvent[] = [];
    if (this.grid) out.push({ event: 'grid', data: this.grid });
    if (this.status) out.push({ event: 'state', data: this.status });
    return out;
  }

  subscribe(cb: (e: HubEvent) => void): () => void {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }

  private emit(e: HubEvent): void {
    for (const cb of this.subs) {
      try {
        cb(e);
      } catch (err) {
        console.error('hub subscriber failed:', err);
      }
    }
  }
}
