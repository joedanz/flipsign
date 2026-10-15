export const ROWS = 10;
export const COLS = 22;
export const CELLS = ROWS * COLS;

/** A board is exactly CELLS characters, row-major, every character in CHARSET. */
export type Grid = string;

/** One lowercase letter per color tile. Text is always uppercase, so these never collide with text. */
export const COLOR_CHARS = {
  red: 'r',
  orange: 'o',
  yellow: 'y',
  green: 'g',
  blue: 'b',
  violet: 'v',
  white: 'w',
} as const;
export type ColorName = keyof typeof COLOR_CHARS;

export const COLOR_HEX: Record<string, string> = {
  r: '#d6312b',
  o: '#f0782d',
  y: '#f6c53d',
  g: '#3aa655',
  b: '#2f7fd1',
  v: '#7c4dbb',
  w: '#f2f2f2',
};

/** Flip order: tiles step forward through this string until they reach their target. */
export const CHARSET = ` ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$()-+&=;:'"%,./?°roygbvw`;

export const BLANK_GRID: Grid = ' '.repeat(CELLS);

export function charIndex(ch: string): number {
  const i = CHARSET.indexOf(ch);
  return i < 0 ? 0 : i;
}

/** How many forward flips take a tile from `from` to `to`. */
export function flipSteps(from: string, to: string): number {
  const n = CHARSET.length;
  return (charIndex(to) - charIndex(from) + n) % n;
}

export function isGrid(v: unknown): v is Grid {
  return typeof v === 'string' && v.length === CELLS && [...v].every((c) => CHARSET.includes(c));
}
