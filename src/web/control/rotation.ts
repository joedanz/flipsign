import type { RotationEntry } from '../../server/store/state';
import { api, type StateResponse } from './api';
import { $, attempt, esc, setValue } from './ui';

let current: RotationEntry[] = [];

function title(e: RotationEntry): string {
  if (e.kind === 'message') return `Message: ${e.text ?? ''}`.slice(0, 40);
  return { clock: 'Clock', weather: 'Weather', quote: 'Quotes' }[e.kind];
}

export function renderRotation(state: StateResponse): void {
  current = state.rotation;
  $('#rotation').innerHTML = current
    .map(
      (e, i) => `<li data-id="${esc(e.id)}">
        <label><input type="checkbox" data-act="toggle" ${e.enabled ? 'checked' : ''}> <span>${esc(title(e))}</span></label>
        <span class="row-actions">
          <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
          <button type="button" data-act="down" ${i === current.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
          ${e.kind === 'message' ? '<button type="button" data-act="del" aria-label="Delete message">✕</button>' : ''}
        </span></li>`,
    )
    .join('');
  setValue($<HTMLInputElement>('#seconds'), String(state.settings.secondsPerScreen));
}

export function setupRotation(reload: () => Promise<void>): void {
  const save = async (next: RotationEntry[]) => {
    await attempt(() => api('PUT', '/api/rotation', next.map(({ id, enabled }) => ({ id, enabled }))));
    await reload();
  };

  $('#rotation').addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('button[data-act]');
    const li = btn?.closest<HTMLElement>('li');
    if (!btn || !li) return;
    const id = li.dataset.id!;
    if (btn.dataset.act === 'del') {
      await attempt(() => api('DELETE', `/api/rotation/${encodeURIComponent(id)}`));
      await reload();
      return;
    }
    const i = current.findIndex((e) => e.id === id);
    const j = btn.dataset.act === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= current.length) return;
    const next = [...current];
    [next[i], next[j]] = [next[j]!, next[i]!];
    await save(next);
  });

  $('#rotation').addEventListener('change', async (ev) => {
    const input = ev.target as HTMLInputElement;
    const li = input.closest<HTMLElement>('li');
    if (!li || input.dataset.act !== 'toggle') return;
    await save(current.map((e) => (e.id === li.dataset.id ? { ...e, enabled: input.checked } : e)));
  });

  $('#seconds').addEventListener('change', async (ev) => {
    await attempt(() => api('PUT', '/api/settings', { secondsPerScreen: Number((ev.target as HTMLInputElement).value) }));
    await reload();
  });
}
