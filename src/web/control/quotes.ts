import type { StoredQuote } from '../../server/store/state';
import { api, type StateResponse } from './api';
import { $, attempt, esc } from './ui';

let all: { quote: StoredQuote; builtIn: boolean }[] = [];
let disabled = new Set<string>();

function visible(): typeof all {
  const needle = $<HTMLInputElement>('#quote-search').value.trim().toLowerCase();
  if (!needle) return all;
  return all.filter(({ quote }) => `${quote.text} ${quote.author ?? ''}`.toLowerCase().includes(needle));
}

function renderList(): void {
  const rows = visible();
  $('#quotes').innerHTML =
    rows
      .map(
        ({ quote: q, builtIn }) => `<li data-id="${esc(q.id)}">
          <label><input type="checkbox" data-act="toggle" ${disabled.has(q.id) ? '' : 'checked'}>
            <span>${esc(q.text)}${q.author ? ` <em>— ${esc(q.author)}</em>` : ''}${builtIn ? '' : ' <em>(yours)</em>'}</span></label>
          ${builtIn ? '' : '<button type="button" data-act="del" aria-label="Delete quote">✕</button>'}</li>`,
      )
      .join('') || '<li class="empty">No quotes match.</li>';
}

export function renderQuotes(state: StateResponse): void {
  all = [
    ...state.quotes.map((quote) => ({ quote, builtIn: false })),
    ...state.starterQuotes.map((quote) => ({ quote, builtIn: true })),
  ];
  disabled = new Set(state.disabledQuotes);
  const active = all.filter(({ quote }) => !disabled.has(quote.id)).length;
  $('#quote-count').textContent = `${active} of ${all.length} quotes active`;
  renderList();
}

export function setupQuotes(reload: () => Promise<void>): void {
  const setEnabled = async (enabled: boolean, ids?: string[]) => {
    await attempt(() => api('PUT', '/api/quotes/enabled', { enabled, ids }));
    await reload();
  };

  $('#quote-search').addEventListener('input', renderList);
  // "All"/"None" act on what the search currently shows, so you can e.g. search "franklin" and switch those off.
  $('#quotes-all').addEventListener('click', () => setEnabled(true, visible().map(({ quote }) => quote.id)));
  $('#quotes-none').addEventListener('click', () => setEnabled(false, visible().map(({ quote }) => quote.id)));

  $('#quotes').addEventListener('change', async (ev) => {
    const input = ev.target as HTMLInputElement;
    const li = input.closest<HTMLElement>('li[data-id]');
    if (!li || input.dataset.act !== 'toggle') return;
    await setEnabled(input.checked, [li.dataset.id!]);
  });

  $('#quotes').addEventListener('click', async (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLElement>('li[data-id]');
    if (!li || !(ev.target as HTMLElement).closest('button[data-act="del"]')) return;
    await attempt(() => api('DELETE', `/api/quotes/${encodeURIComponent(li.dataset.id!)}`));
    await reload();
  });

  $('#quote-add').addEventListener('click', async () => {
    const text = $<HTMLTextAreaElement>('#quote-text');
    const author = $<HTMLInputElement>('#quote-author');
    const ok = await attempt(() => api('POST', '/api/quotes', { text: text.value, author: author.value || undefined }));
    if (!ok) return;
    text.value = '';
    author.value = '';
    await reload();
  });
}
