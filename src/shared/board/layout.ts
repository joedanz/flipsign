import { BLANK_GRID, CELLS, CHARSET, COLOR_CHARS, COLS, ROWS, type Grid } from './charset';

export type LayoutResult = { ok: true; grid: Grid } | { ok: false; overflow: string };

const TOKEN = /\{([A-Z]+)\}/g;
const COLOR_BY_NAME = COLOR_CHARS as Record<string, string>;

/** Phone keyboards (iOS Smart Punctuation) emit these; show them as their plain equivalents. */
const PUNCTUATION: Record<string, string> = {
  '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...',
};

/** Uppercase, resolve {color} tokens, fold punctuation and accents, drop everything the board cannot show. */
function cleanLine(raw: string): string {
  return raw
    .replace(/\t/g, ' ')
    .replace(/[‘’“”–—…]/g, (c) => PUNCTUATION[c]!)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(TOKEN, (_, name: string) => COLOR_BY_NAME[name.toLowerCase()] ?? '')
    .split('')
    .filter((ch) => CHARSET.includes(ch))
    .join('');
}

function wrap(paragraph: string): string[] {
  const words = paragraph.split(' ').filter(Boolean);
  if (words.length === 0) return [''];
  const out: string[] = [];
  let line = '';
  for (let word of words) {
    while (word.length > COLS) {
      if (line) {
        out.push(line);
        line = '';
      }
      out.push(word.slice(0, COLS));
      word = word.slice(COLS);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= COLS) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Center already-clean lines (each ≤ COLS) on the board. Lines beyond ROWS are dropped. */
export function layoutLines(input: string[]): Grid {
  const rows = input.slice(0, ROWS);
  const top = Math.floor((ROWS - rows.length) / 2);
  const cells: string[] = new Array<string>(CELLS).fill(' ');
  rows.forEach((line, r) => {
    const text = line.slice(0, COLS);
    const left = Math.floor((COLS - text.length) / 2);
    for (let i = 0; i < text.length; i++) cells[(top + r) * COLS + left + i] = text.charAt(i);
  });
  return cells.join('');
}

export function layoutText(input: string): LayoutResult {
  const lines = input.split('\n').flatMap((p) => wrap(cleanLine(p)));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (lines.length > ROWS) return { ok: false, overflow: lines.slice(ROWS).join(' ') };
  return { ok: true, grid: layoutLines(lines) };
}

export function padCenter(s: string, width: number): string {
  const left = Math.max(0, Math.floor((width - s.length) / 2));
  return (' '.repeat(left) + s).padEnd(width, ' ');
}

export function gridRows(grid: Grid): string[] {
  return Array.from({ length: ROWS }, (_, r) => grid.slice(r * COLS, (r + 1) * COLS));
}

export function isBlankGrid(grid: Grid): boolean {
  return grid === BLANK_GRID || grid.trim() === '';
}
