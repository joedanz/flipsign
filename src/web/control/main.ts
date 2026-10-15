import { BoardRenderer } from '../display/renderer';
import { api, type StateResponse } from './api';
import { setupCompose } from './compose';
import { renderQuotes, setupQuotes } from './quotes';
import { renderRotation, setupRotation } from './rotation';
import { renderSettings, setupSettings } from './settings';
import { watchBuild } from '../shared/buildWatcher';
import { setupTabs } from './tabs';
import { $, attempt } from './ui';

const live = new BoardRenderer($<HTMLCanvasElement>('#live-board'), { instant: true, fill: 0.98 });
let state: StateResponse | undefined;
let clockOffset = 0; // server clock minus this device's clock

const clockTime = (serverMs: number) =>
  new Date(serverMs - clockOffset).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function renderStatus(): void {
  if (!state) return;
  const v = state.view;
  const clear = $('#clear');
  if (v.mode === 'override') {
    $('#status').textContent = v.expiresAt ? `Message · clears at ${clockTime(v.expiresAt)}` : 'Message · until cleared';
    clear.hidden = false;
  } else {
    const left = v.nextAt ? Math.max(0, Math.ceil((v.nextAt - (Date.now() + clockOffset)) / 1000)) : 0;
    const countdown = v.nextAt ? ` · next in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
    $('#status').textContent = `Rotation · ${v.label}${countdown}`;
    clear.hidden = true;
  }
}

async function load(): Promise<void> {
  try {
    state = await api<StateResponse>('GET', '/api/state');
  } catch {
    $('#status').textContent = 'Can’t reach the server';
    return;
  }
  clockOffset = state.serverNow - Date.now();
  live.setGrid(state.view.grid);
  renderStatus();
  renderRotation(state);
  renderQuotes(state);
  renderSettings(state);
}

const onBuild = watchBuild(); // reload after a server upgrade, so the page never runs stale code

function connect(): void {
  const es = new EventSource('/events');
  es.addEventListener('state', () => void load());
  es.addEventListener('hello', (e) => onBuild((JSON.parse((e as MessageEvent<string>).data) as { buildId: string }).buildId));
  es.addEventListener('grid', (e) => live.setGrid((JSON.parse((e as MessageEvent<string>).data) as { grid: string }).grid));
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) setTimeout(connect, 3000);
  };
}

setupCompose(load);
setupTabs(() => window.dispatchEvent(new Event('resize')));
setupRotation(load);
setupQuotes(load);
setupSettings(load);
$('#clear').addEventListener('click', async () => {
  await attempt(() => api('DELETE', '/api/override'));
  await load();
});
window.addEventListener('resize', () => live.resize());
setInterval(renderStatus, 1000);
connect();
void load();
