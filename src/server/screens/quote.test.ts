import { describe, expect, it } from 'vitest';
import { gridRows } from '../../shared/board/layout';
import { QuoteDeck, layoutQuote, type Quote } from './quote';
import { STARTER_QUOTES } from './starterQuotes';

const q = (id: string, text = id.toUpperCase(), author?: string): Quote => ({ id, text, author });

describe('layoutQuote', () => {
  it('puts the attribution on its own line after a blank line', () => {
    const r = layoutQuote({ text: 'KNOWLEDGE IS POWER.', author: 'FRANCIS BACON' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rows = gridRows(r.grid).map((x) => x.trim());
    expect(rows).toEqual(['', '', '', 'KNOWLEDGE IS POWER.', '', '- FRANCIS BACON', '', '', '', '']);
  });

  it('works without an author', () => {
    const r = layoutQuote({ text: 'HELLO' });
    expect(r.ok).toBe(true);
  });

  it('drops the blank line before the author when that is the only way to fit', () => {
    const text = Array(18).fill('ABCDEFGHIJ').join(' '); // wraps to 9 lines: 9 + blank + author would be 11 rows
    const r = layoutQuote({ text, author: 'X' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rows = gridRows(r.grid).map((x) => x.trim());
    expect(rows[8]).toBe('ABCDEFGHIJ ABCDEFGHIJ');
    expect(rows[9]).toBe('- X');
  });

  it('rejects a quote that cannot fit', () => {
    expect(layoutQuote({ text: 'WORD '.repeat(60), author: 'X' }).ok).toBe(false);
  });
});

describe('QuoteDeck', () => {
  it('shows every quote once per cycle', () => {
    const deck = new QuoteDeck(() => 0.5);
    const quotes = [q('a'), q('b'), q('c')];
    const seen = [deck.next(quotes)!.id, deck.next(quotes)!.id, deck.next(quotes)!.id];
    expect(new Set(seen).size).toBe(3);
  });

  it('never repeats a quote back-to-back across a reshuffle', () => {
    const values = [0.999, 0];
    let k = 0;
    const deck = new QuoteDeck(() => values[k++] ?? 0);
    const quotes = [q('a'), q('b')];
    const drawn = [1, 2, 3].map(() => deck.next(quotes)!.id);
    expect(drawn).toEqual(['b', 'a', 'b']); // without the guard the third draw would be 'a'
  });

  it('forgets quotes that were deleted', () => {
    const deck = new QuoteDeck(() => 0.5);
    deck.next([q('a'), q('b')]);
    expect(deck.next([q('b')])!.id).toBe('b');
  });

  it('returns undefined when there are no quotes', () => {
    expect(new QuoteDeck().next([])).toBeUndefined();
  });
});

describe('STARTER_QUOTES', () => {
  it('has at least 40 quotes with unique ids', () => {
    expect(STARTER_QUOTES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(STARTER_QUOTES.map((x) => x.id)).size).toBe(STARTER_QUOTES.length);
  });

  it.each(STARTER_QUOTES.map((x) => [x.id, x] as const))('%s fits on the board', (_id, quote) => {
    expect(layoutQuote(quote).ok).toBe(true);
  });
});
