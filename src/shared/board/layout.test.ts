import { describe, expect, it } from 'vitest';
import { gridRows, isBlankGrid, layoutLines, layoutText, padCenter } from './layout';

const grid = (input: string) => {
  const r = layoutText(input);
  if (!r.ok) throw new Error(`overflow: ${r.overflow}`);
  return r.grid;
};
const lines = (input: string) => gridRows(grid(input)).map((r) => r.trim());

describe('layoutText', () => {
  it('treats a tab as a space between words', () => {
    expect(lines('HELLO\tWORLD').filter(Boolean)).toEqual(['HELLO WORLD']);
  });

  it('centers one line horizontally and vertically', () => {
    const rows = gridRows(grid('HI'));
    expect(rows[2]).toBe(' '.repeat(10) + 'HI' + ' '.repeat(10));
    expect(rows.filter((r) => r.trim()).length).toBe(1);
  });

  it('wraps at word boundaries', () => {
    expect(lines('THE QUICK BROWN FOX JUMPS OVER')).toEqual(['', '', 'THE QUICK BROWN FOX', 'JUMPS OVER', '', '']);
  });

  it('hard-splits a word longer than the board is wide', () => {
    expect(lines('A'.repeat(30))).toEqual(['', '', 'A'.repeat(22), 'A'.repeat(8), '', '']);
  });

  it('keeps explicit newlines and blank lines', () => {
    expect(lines('A\n\nB')).toEqual(['', 'A', '', 'B', '', '']);
  });

  it('trims leading and trailing blank lines', () => {
    expect(grid('\n\nHI\n\n')).toBe(grid('HI'));
  });

  it('treats CRLF like LF', () => {
    expect(grid('A\r\nB')).toBe(grid('A\nB'));
  });

  it('uppercases and strips unsupported characters', () => {
    expect(lines('hello, wor~ld! 🎉')[2]).toBe('HELLO, WORLD!');
  });

  it('maps phone smart punctuation and accents to board characters', () => {
    expect(lines('Don’t say “hi” — ok…')[2]).toBe('DON\'T SAY "HI" - OK...');
    expect(lines('café')[2]).toBe('CAFE');
  });

  it('turns color tokens into color tiles and drops unknown tokens', () => {
    expect(lines('a{red}{BLUE}{nope}b')[2]).toBe('ArbB');
  });

  it('reports overflow instead of truncating', () => {
    expect(layoutText('A\nB\nC\nD\nE\nF\nG')).toEqual({ ok: false, overflow: 'G' });
    expect(layoutText('A\nB\nC\nD\nE\nF').ok).toBe(true);
  });

  it('lays out an emoji-only message as a blank board (callers reject it)', () => {
    const r = layoutText('🎉');
    expect(r.ok && isBlankGrid(r.grid)).toBe(true);
  });

  it('lays out empty input as a blank board', () => {
    const r = layoutText('');
    expect(r.ok && isBlankGrid(r.grid)).toBe(true);
  });
});

describe('layoutLines / padCenter', () => {
  it('centers each line and uses six rows from the top when given six', () => {
    const rows = gridRows(layoutLines(['', 'AB', '', '', '', '']));
    expect(rows[1]).toBe(' '.repeat(10) + 'AB' + ' '.repeat(10));
  });

  it('pads text to center it in a fixed width', () => {
    expect(padCenter('AB', 7)).toBe('  AB   ');
  });
});
