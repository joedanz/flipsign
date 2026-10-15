import { describe, expect, it } from 'vitest';
import { computeMetrics, tileOrigin } from './metrics';

describe('computeMetrics', () => {
  it('fills a 1920x1080 TV with the 10x22 board at the display\'s fill', () => {
    const m = computeMetrics(1920, 1080, 0.98);
    expect(m).toMatchObject({ tileW: 71, tileH: 92, halfH: 46, gap: 10, pad: 21, boardW: 1814, boardH: 1052, boardX: 53, boardY: 14 });
    expect(m.tileH / m.tileW).toBeLessThan(1.4); // tiles keep their shape; the screen is filled by rows, not stretching
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

describe('tileOrigin', () => {
  it('places tiles on a grid inside the board padding', () => {
    const m = computeMetrics(1920, 1080);
    expect(tileOrigin(m, 0, 0)).toEqual({ x: m.boardX + m.pad, y: m.boardY + m.pad });
    expect(tileOrigin(m, 1, 2)).toEqual({ x: m.boardX + m.pad + 2 * (m.tileW + m.gap), y: m.boardY + m.pad + (m.tileH + m.gap) });
  });
});
