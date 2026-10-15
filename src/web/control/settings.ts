import { api, type StateResponse } from './api';
import { $, attempt, setValue, toast } from './ui';

export function renderSettings(state: StateResponse): void {
  const s = state.settings;
  setValue($<HTMLInputElement>('#location'), s.location?.query ?? '');
  $('#location-current').textContent = s.location ? `Using ${s.location.name}` : 'No location set';
  setValue($<HTMLSelectElement>('#unit'), s.unit);
  setValue($<HTMLSelectElement>('#hour12'), s.hour12 ? '12' : '24');
  $<HTMLInputElement>('#sound').checked = s.sound;
  setValue($<HTMLInputElement>('#flip'), String(s.flipMs));
  $('#flip-out').textContent = `${s.flipMs} ms`;
}

export function setupSettings(reload: () => Promise<void>): void {
  const put = async (patch: Record<string, unknown>) => {
    await attempt(() => api('PUT', '/api/settings', patch));
    await reload();
  };

  $('#location-set').addEventListener('click', async () => {
    const ok = await attempt(() => api('PUT', '/api/settings', { locationQuery: $<HTMLInputElement>('#location').value }));
    if (ok) toast('Location saved');
    await reload();
  });
  $('#unit').addEventListener('change', (e) => put({ unit: (e.target as HTMLSelectElement).value }));
  $('#hour12').addEventListener('change', (e) => put({ hour12: (e.target as HTMLSelectElement).value === '12' }));
  $('#sound').addEventListener('change', (e) => put({ sound: (e.target as HTMLInputElement).checked }));
  $('#flip').addEventListener('input', (e) => ($('#flip-out').textContent = `${(e.target as HTMLInputElement).value} ms`));
  $('#flip').addEventListener('change', (e) => put({ flipMs: Number((e.target as HTMLInputElement).value) }));
}
