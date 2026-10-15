import { MARGIN_ROWS } from './metrics';
import { BoardRenderer } from './renderer';
import { Clack } from './sound';

const canvas = document.getElementById('board') as HTMLCanvasElement;
const clack = new Clack();
const params = new URLSearchParams(location.search);
const renderer = new BoardRenderer(canvas, { fill: 0.98, marginRows: MARGIN_ROWS, instant: params.has('instant'), onStep: () => clack.play() });

window.addEventListener('resize', () => renderer.resize());
for (const type of ['keydown', 'pointerdown']) window.addEventListener(type, () => clack.unlock(), { once: true });

// ---- live connection: keep the last grid on screen if the server goes away, reconnect quietly ----
const STALE_MS = 45_000; // the server pings every 15 s
let lastEventAt = Date.now();
let source: EventSource | undefined;

function connect(): void {
  source?.close();
  const es = new EventSource('/events');
  source = es;
  es.addEventListener('grid', (e) => {
    lastEventAt = Date.now();
    const d = JSON.parse((e as MessageEvent<string>).data) as { grid: string; flipMs: number; sound: boolean };
    renderer.flipMs = d.flipMs;
    clack.enabled = d.sound;
    renderer.setGrid(d.grid);
  });
  for (const name of ['state', 'ping']) es.addEventListener(name, () => (lastEventAt = Date.now()));
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) setTimeout(connect, 3000); // browsers only auto-retry some failures
  };
}

setInterval(() => {
  if (Date.now() - lastEventAt > STALE_MS) {
    lastEventAt = Date.now();
    connect(); // half-open connection (Wi-Fi blip): start over
  }
}, 10_000);

connect();

if (params.has('debug')) {
  const el = Object.assign(document.createElement('div'), { id: 'debug' });
  document.body.appendChild(el);
  setInterval(() => {
    const s = renderer.stats;
    el.textContent = `FPS ${s.fps}  worst ${s.worstFps ?? '-'}  flipping ${s.flipping}  draw ${s.drawMs.toFixed(1)}ms  ${canvas.width}x${canvas.height}`;
  }, 500);
}
