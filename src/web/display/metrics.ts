import { COLS, ROWS } from '../../shared/board/charset';

const GAP = 0.14; // gap between tiles, as a fraction of tile width
const PAD = 0.3; // board padding, as a fraction of tile width
const ASPECT = 1.3; // tile height / width

/** Blank rows drawn above and below the 6 real ones, so the board fills a 16:9 screen. Control-page CSS aspect-ratio depends on this. */
export const MARGIN_ROWS = 2;

export interface Metrics {
  tileW: number;
  tileH: number;
  halfH: number;
  gap: number;
  pad: number;
  marginRows: number;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
}

/**
 * Fit the board into a canvas, centered, filling `fill` of the limiting dimension.
 * `marginRows` adds that many blank rows above and below the 6 real ones, to fill a 16:9 screen.
 */
export function computeMetrics(canvasW: number, canvasH: number, fill = 0.95, marginRows = 0): Metrics {
  const rows = ROWS + 2 * marginRows;
  const unitsW = COLS + (COLS - 1) * GAP + 2 * PAD;
  const unitsH = rows * ASPECT + (rows - 1) * GAP + 2 * PAD;
  const tileW = Math.max(2, Math.floor(Math.min((canvasW * fill) / unitsW, (canvasH * fill) / unitsH)));
  const tileH = Math.max(2, Math.round(tileW * ASPECT) & ~1); // even, so both halves are equal
  const gap = Math.round(tileW * GAP);
  const pad = Math.round(tileW * PAD);
  const boardW = COLS * tileW + (COLS - 1) * gap + 2 * pad;
  const boardH = rows * tileH + (rows - 1) * gap + 2 * pad;
  return {
    tileW,
    tileH,
    halfH: tileH / 2,
    gap,
    pad,
    marginRows,
    boardW,
    boardH,
    boardX: Math.round((canvasW - boardW) / 2),
    boardY: Math.round((canvasH - boardH) / 2),
  };
}

export function tileOrigin(m: Metrics, row: number, col: number): { x: number; y: number } {
  return { x: m.boardX + m.pad + col * (m.tileW + m.gap), y: m.boardY + m.pad + (row + m.marginRows) * (m.tileH + m.gap) };
}
