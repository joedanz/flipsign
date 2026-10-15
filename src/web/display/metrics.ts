import { COLS, ROWS } from '../../shared/board/charset';

const GAP = 0.14; // gap between tiles, as a fraction of tile width
const PAD = 0.3; // board padding, as a fraction of tile width
const ASPECT = 1.3; // tile height / width

export interface Metrics {
  tileW: number;
  tileH: number;
  halfH: number;
  gap: number;
  pad: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
}

/** Fit the board into a canvas, centered, filling `fill` of the limiting dimension. */
export function computeMetrics(canvasW: number, canvasH: number, fill = 0.95): Metrics {
  const unitsW = COLS + (COLS - 1) * GAP + 2 * PAD;
  const unitsH = ROWS * ASPECT + (ROWS - 1) * GAP + 2 * PAD;
  const tileW = Math.max(2, Math.floor(Math.min((canvasW * fill) / unitsW, (canvasH * fill) / unitsH)));
  const tileH = Math.max(2, Math.round(tileW * ASPECT) & ~1); // even, so both halves are equal
  const gap = Math.round(tileW * GAP);
  const pad = Math.round(tileW * PAD);
  const boardW = COLS * tileW + (COLS - 1) * gap + 2 * pad;
  const boardH = ROWS * tileH + (ROWS - 1) * gap + 2 * pad;
  return {
    tileW,
    tileH,
    halfH: tileH / 2,
    gap,
    pad,
    boardW,
    boardH,
    boardX: Math.round((canvasW - boardW) / 2),
    boardY: Math.round((canvasH - boardH) / 2),
  };
}

export function tileOrigin(m: Metrics, row: number, col: number): { x: number; y: number } {
  return { x: m.boardX + m.pad + col * (m.tileW + m.gap), y: m.boardY + m.pad + row * (m.tileH + m.gap) };
}
