import { layoutText, type LayoutResult } from '../../shared/board/layout';

export interface Quote {
  id: string;
  text: string;
  author?: string;
}

/** Quote + blank line + "- AUTHOR"; falls back to no blank line if that is the only way to fit. */
export function layoutQuote(q: Pick<Quote, 'text' | 'author'>): LayoutResult {
  if (!q.author) return layoutText(q.text);
  const spaced = layoutText(`${q.text}\n\n- ${q.author}`);
  return spaced.ok ? spaced : layoutText(`${q.text}\n- ${q.author}`);
}

/** Shuffled draws without repeats until the deck is exhausted. */
export class QuoteDeck {
  private bag: string[] = [];
  private last: string | undefined;

  constructor(private readonly rng: () => number = Math.random) {}

  next(quotes: Quote[]): Quote | undefined {
    if (quotes.length === 0) return undefined;
    const ids = new Set(quotes.map((x) => x.id));
    this.bag = this.bag.filter((id) => ids.has(id));
    if (this.bag.length === 0) this.bag = this.shuffled(quotes.map((x) => x.id));
    const id = this.bag.pop()!;
    this.last = id;
    return quotes.find((x) => x.id === id);
  }

  private shuffled(ids: string[]): string[] {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    // draws pop from the end: don't open the new cycle with the quote that just ended the last one
    if (a.length > 1 && a[a.length - 1] === this.last) [a[a.length - 1], a[0]] = [a[0]!, a[a.length - 1]!];
    return a;
  }
}
