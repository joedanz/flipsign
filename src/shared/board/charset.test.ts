import { describe, expect, it } from 'vitest';
import { BLANK_GRID, CELLS, CHARSET, COLS, ROWS, flipSteps, isGrid, nextFlap } from './charset';

describe('charset', () => {
  it('is a 10x22 board of 220 cells', () => {
    expect(ROWS).toBe(10);
    expect(COLS).toBe(22);
    expect(CELLS).toBe(220);
    expect(BLANK_GRID).toHaveLength(220);
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
    expect(flipSteps('B', 'A')).toBe(CHARSET.indexOf('°')); // the long way round, skipping the colors
  });

  it('skips the color flaps when flipping to a non-color character', () => {
    const at = (ch: string) => CHARSET.indexOf(ch);
    expect(nextFlap(at('°'), at('A'))).toBe(at(' ')); // straight past roygbvw
    expect(flipSteps('°', 'A')).toBe(2);
    expect(flipSteps('A', ' ')).toBe(CHARSET.indexOf('°')); // a text-only lap is shorter
  });

  it('flips through the colors when the target is a color', () => {
    const at = (ch: string) => CHARSET.indexOf(ch);
    expect(nextFlap(at('°'), at('g'))).toBe(at('r'));
    expect(flipSteps('°', 'g')).toBe(4);
  });

  it('leaves a color tile by the shortest way back to text', () => {
    const at = (ch: string) => CHARSET.indexOf(ch);
    expect(nextFlap(at('r'), at('A'))).toBe(at(' '));
    expect(flipSteps('r', 'A')).toBe(2);
    expect(nextFlap(at('r'), at('b'))).toBe(at('o'));
  });

  it('treats unknown characters as blank', () => {
    expect(flipSteps('~', 'A')).toBe(1);
  });

  it('validates grids', () => {
    expect(isGrid(BLANK_GRID)).toBe(true);
    expect(isGrid('A')).toBe(false);
    expect(isGrid('~'.repeat(220))).toBe(false);
    expect(isGrid(42)).toBe(false);
  });
});
