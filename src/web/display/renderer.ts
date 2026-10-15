import { CELLS, CHARSET, COLOR_HEX, COLS, charIndex, type Grid } from '../../shared/board/charset';
import { computeMetrics, tileOrigin, type Metrics } from './metrics';

const PAGE_BG = '#0a0a0a';
const BOARD_BG = '#111';

interface Tile {
  x: number;
  y: number;
  row: number;
  col: number;
  cur: number;
  target: number;
  busy: boolean;
  startAt: number;
  flipStart: number;
}

export interface RendererOptions {
  /** Skip flip animation (control-page previews). */
  instant?: boolean;
  flipMs?: number;
  /** Fraction of the canvas the board may fill. */
  fill?: number;
  /** Called once per completed flap, for sound. */
  onStep?: () => void;
}

/**
 * Draws the whole board on one canvas. Every character is pre-rendered once into an atlas;
 * a frame only copies rectangles for tiles that are mid-flip, and the loop stops when idle.
 */
export class BoardRenderer {
  flipMs: number;
  onStep?: () => void;
  readonly stats = { fps: 0, worstFps: null as number | null, drawMs: 0, flipping: 0 };

  private readonly ctx: CanvasRenderingContext2D;
  private readonly instant: boolean;
  private readonly fill: number;
  private readonly tiles: Tile[] = [];
  private atlas!: HTMLCanvasElement;
  private m!: Metrics;
  private active = 0;
  private running = false;
  private frames = 0;
  private lastSecond = 0;

  constructor(private readonly canvas: HTMLCanvasElement, opts: RendererOptions = {}) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.instant = opts.instant ?? false;
    this.flipMs = opts.flipMs ?? 70;
    this.fill = opts.fill ?? 0.95;
    this.onStep = opts.onStep;
    for (let i = 0; i < CELLS; i++) {
      this.tiles.push({ x: 0, y: 0, row: Math.floor(i / COLS), col: i % COLS, cur: 0, target: 0, busy: false, startAt: 0, flipStart: 0 });
    }
    this.resize();
  }

  /** Re-measure the canvas, rebuild the glyph atlas and repaint the board as it stands. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.m = computeMetrics(w, h, this.fill);
    for (const t of this.tiles) Object.assign(t, tileOrigin(this.m, t.row, t.col));
    this.buildAtlas();
    this.ctx.fillStyle = PAGE_BG;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.fillStyle = BOARD_BG;
    this.ctx.fillRect(this.m.boardX, this.m.boardY, this.m.boardW, this.m.boardH);
    for (const t of this.tiles) this.drawTile(t, 0);
  }

  setGrid(grid: Grid): void {
    const now = performance.now();
    if (this.active === 0) this.stats.worstFps = null;
    for (let i = 0; i < CELLS; i++) {
      const t = this.tiles[i]!;
      t.target = charIndex(grid.charAt(i));
      if (this.instant) {
        if (t.cur !== t.target) {
          t.cur = t.target;
          this.drawTile(t, 0);
        }
      } else if (!t.busy && t.cur !== t.target) {
        t.busy = true;
        this.active++;
        t.flipStart = 0;
        t.startAt = now + t.col * 25 + t.row * 15 + Math.random() * 120; // left-to-right ripple with jitter
      }
    }
    if (this.active > 0) this.ensureLoop();
  }

  private ensureLoop(): void {
    if (this.running) return;
    this.running = true;
    this.frames = 0;
    this.lastSecond = performance.now();
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (): void => {
    const t0 = performance.now();
    for (const t of this.tiles) {
      if (!t.busy || t0 < t.startAt) continue;
      if (t.flipStart === 0) t.flipStart = t0;
      let p = (t0 - t.flipStart) / this.flipMs;
      while (p >= 1) {
        // a flap (or several, after a long frame) completed
        t.cur = (t.cur + 1) % CHARSET.length;
        this.onStep?.();
        if (t.cur === t.target) break;
        t.flipStart += this.flipMs;
        p -= 1;
      }
      if (t.cur === t.target) {
        t.busy = false;
        t.flipStart = 0;
        this.active--;
        this.drawTile(t, 0);
      } else {
        this.drawTile(t, Math.max(p, 0.001));
      }
    }
    this.stats.drawMs = this.stats.drawMs * 0.9 + (performance.now() - t0) * 0.1;
    this.measure(t0);
    if (this.active > 0) requestAnimationFrame(this.frame);
    else this.running = false;
  };

  private measure(now: number): void {
    this.frames++;
    this.stats.flipping = this.active;
    if (now - this.lastSecond >= 1000) {
      this.stats.fps = Math.round((this.frames * 1000) / (now - this.lastSecond));
      this.frames = 0;
      this.lastSecond = now;
      if (this.active > 0) this.stats.worstFps = Math.min(this.stats.worstFps ?? Infinity, this.stats.fps);
    }
  }

  private buildAtlas(): void {
    const { tileW, tileH, halfH } = this.m;
    this.atlas = document.createElement('canvas');
    this.atlas.width = CHARSET.length * tileW;
    this.atlas.height = tileH;
    const a = this.atlas.getContext('2d')!;
    a.font = `600 ${Math.round(tileH * 0.62)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    for (let i = 0; i < CHARSET.length; i++) {
      const ch = CHARSET.charAt(i);
      const x = i * tileW;
      const color = COLOR_HEX[ch];
      a.fillStyle = color ?? '#232323';
      a.fillRect(x, 0, tileW, halfH);
      a.fillStyle = color ?? '#1c1c1c';
      a.fillRect(x, halfH, tileW, halfH);
      if (!color && ch !== ' ') {
        a.fillStyle = '#f2f2f2';
        a.fillText(ch, x + tileW / 2, halfH + tileH * 0.03);
      }
    }
  }

  private half(index: number, top: boolean, dx: number, dy: number, dh: number): void {
    if (dh < 1) return;
    const { tileW, halfH } = this.m;
    this.ctx.drawImage(this.atlas, index * tileW, top ? 0 : halfH, tileW, halfH, dx, dy, tileW, dh);
  }

  /** p = 0 draws the tile at rest; 0 < p < 1 draws a flap falling (first half) then settling (second half). */
  private drawTile(t: Tile, p: number): void {
    const { tileW, tileH, halfH } = this.m;
    const { x, y } = t;
    const ctx = this.ctx;
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(x, y, tileW, tileH);
    if (p <= 0) {
      this.half(t.cur, true, x, y, halfH);
      this.half(t.cur, false, x, y + halfH, halfH);
    } else {
      const next = (t.cur + 1) % CHARSET.length;
      this.half(next, true, x, y, halfH); // revealed behind the falling flap
      this.half(t.cur, false, x, y + halfH, halfH); // old bottom until the new flap lands
      let s: number;
      let fy: number;
      let fh: number;
      if (p < 0.5) {
        s = Math.cos(p * Math.PI);
        fh = Math.round(halfH * s);
        fy = y + halfH - fh;
        this.half(t.cur, true, x, fy, fh);
      } else {
        s = -Math.cos(p * Math.PI);
        fh = Math.round(halfH * s);
        fy = y + halfH;
        this.half(next, false, x, fy, fh);
      }
      if (fh > 0) {
        ctx.fillStyle = `rgba(0,0,0,${(0.55 * (1 - s)).toFixed(2)})`;
        ctx.fillRect(x, fy, tileW, fh);
      }
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y + halfH - 1, tileW, 2); // hinge line
  }
}
