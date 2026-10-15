import { describe, expect, it } from 'vitest';
import { BLANK_GRID, CELLS, CHARSET, COLS, ROWS, flipSteps, isGrid } from './charset';

describe('charset', () => {
  it('is a 6x22 board of 132 cells', () => {
    expect(ROWS).toBe(6);
    expect(COLS).toBe(22);
    expect(CELLS).toBe(132);
    expect(BLANK_GRID).toHaveLength(132);
  });

  it('starts with space and has no duplicate characters', () => {
    expect(CHARSET[0]).toBe(' ');
    expect(new Set(CHARSET).size).toBe(CHARSET.length);
  });

  it('ends with the seven color tiles', () => {
    expect(CHARSET.endsWith('roygbvw')).toBe(true);
  });

  it('counts flip steps forward through the charset, wrapping around', () => {
    expect(flipSteps(' ', 'A')).toBe(1);
    expect(flipSteps('A', 'A')).toBe(0);
    expect(flipSteps('A', ' ')).toBe(CHARSET.length - 1);
  });

  it('treats unknown characters as blank', () => {
    expect(flipSteps('~', 'A')).toBe(1);
  });

  it('validates grids', () => {
    expect(isGrid(BLANK_GRID)).toBe(true);
    expect(isGrid('A')).toBe(false);
    expect(isGrid('~'.repeat(132))).toBe(false);
    expect(isGrid(42)).toBe(false);
  });
});
