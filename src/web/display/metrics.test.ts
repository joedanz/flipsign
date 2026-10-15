import { describe, expect, it } from 'vitest';
import { MARGIN_ROWS, computeMetrics, tileOrigin } from './metrics';

describe('computeMetrics', () => {
  it('sizes the board for a 1920x1080 TV', () => {
    const m = computeMetrics(1920, 1080);
    expect(m).toMatchObject({ tileW: 71, tileH: 92, halfH: 46, gap: 10, pad: 21, boardW: 1814, boardH: 644, boardX: 53, boardY: 218 });
  });

  it('keeps the board inside the canvas and centered', () => {
    for (const [w, h] of [[1920, 960], [1280, 720], [3840, 2160], [390, 150]] as const) {
      const m = computeMetrics(w, h);
      expect(m.boardW).toBeLessThanOrEqual(w);
      expect(m.boardH).toBeLessThanOrEqual(h);
      expect(Math.abs(m.boardX * 2 + m.boardW - w)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.boardY * 2 + m.boardH - h)).toBeLessThanOrEqual(1);
    }
  });

  it('always uses an even tile height so the two halves match', () => {
    for (let w = 100; w < 2000; w += 37) expect(computeMetrics(w, w / 2).tileH % 2).toBe(0);
  });

  it('survives a collapsed canvas without NaN', () => {
    const m = computeMetrics(1, 1);
    expect(m.tileW).toBeGreaterThan(0);
    expect(Number.isFinite(m.boardX)).toBe(true);
  });
});

describe('computeMetrics with margin rows', () => {
  it('keeps the tile shape and adds blank rows above and below', () => {
    const plain = computeMetrics(1920, 1080);
    const m = computeMetrics(1920, 1080, 0.95, 1);
    expect(m).toMatchObject({ tileW: plain.tileW, tileH: plain.tileH, gap: plain.gap, pad: plain.pad, boardW: plain.boardW });
    expect(m.boardH).toBe(plain.boardH + 2 * (plain.tileH + plain.gap));
    expect(m.boardH / 1080).toBeGreaterThan(0.75);
  });

  it('puts grid row 0 one tile-row below the board padding', () => {
    const m = computeMetrics(1920, 1080, 0.95, 1);
    expect(tileOrigin(m, 0, 0).y).toBe(m.boardY + m.pad + m.tileH + m.gap);
  });

  it('shrinks tiles rather than overflowing a short canvas', () => {
    const m = computeMetrics(1920, 540, 0.95, 1);
    expect(m.boardH).toBeLessThanOrEqual(540);
  });
});

describe('MARGIN_ROWS', () => {
  it('lets the board use nearly the whole height of a 16:9 TV without squashing the tiles', () => {
    const m = computeMetrics(1920, 1080, 0.98, MARGIN_ROWS);
    expect(MARGIN_ROWS).toBe(2);
    expect(m.boardH / 1080).toBeGreaterThan(0.95);
    expect(m.boardW / 1920).toBeGreaterThan(0.93);
    expect(m.tileH / m.tileW).toBeLessThan(1.4);
  });
});

describe('tileOrigin', () => {
  it('places tiles on a grid inside the board padding', () => {
    const m = computeMetrics(1920, 1080);
    expect(tileOrigin(m, 0, 0)).toEqual({ x: m.boardX + m.pad, y: m.boardY + m.pad });
    expect(tileOrigin(m, 1, 2)).toEqual({ x: m.boardX + m.pad + 2 * (m.tileW + m.gap), y: m.boardY + m.pad + (m.tileH + m.gap) });
  });
});
