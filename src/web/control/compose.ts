import { COLOR_CHARS, COLOR_HEX, type ColorName } from '../../shared/board/charset';
import { isBlankGrid, layoutText } from '../../shared/board/layout';
import { MARGIN_ROWS } from '../display/metrics';
import { BoardRenderer } from '../display/renderer';
import { api } from './api';
import { $, attempt, toast } from './ui';

export function setupCompose(reload: () => Promise<void>): void {
  const text = $<HTMLTextAreaElement>('#text');
  const warn = $('#warn');
  const duration = $<HTMLSelectElement>('#duration');
  const preview = new BoardRenderer($<HTMLCanvasElement>('#preview'), { instant: true, fill: 0.98, marginRows: MARGIN_ROWS });

  const update = () => {
    const r = layoutText(text.value);
    if (r.ok) {
      preview.setGrid(r.grid);
      const blank = text.value.trim() !== '' && isBlankGrid(r.grid);
      warn.hidden = !blank;
      warn.textContent = blank ? 'Nothing to show: no supported characters in that message' : '';
    } else {
      warn.hidden = false;
      warn.textContent = `Doesn't fit: "${r.overflow}"`;
    }
  };
  text.addEventListener('input', update);
  window.addEventListener('resize', () => preview.resize());

  $('#colors').innerHTML = (Object.keys(COLOR_CHARS) as ColorName[])
    .map(
      (name) =>
        `<button type="button" class="swatch" data-color="${name}" style="background:${COLOR_HEX[COLOR_CHARS[name]]}" aria-label="Insert ${name} tile"></button>`,
    )
    .join('');
  $('#colors').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-color]');
    if (!btn) return;
    text.setRangeText(`{${btn.dataset.color}}`, text.selectionStart, text.selectionEnd, 'end');
    text.focus();
    update();
  });

  $('#send').addEventListener('click', async () => {
    const ok = await attempt(() => api('POST', '/api/message', { text: text.value, duration: duration.value }));
    if (!ok) return;
    text.value = '';
    update();
    toast('Sent');
    await reload();
  });

  update();
}
