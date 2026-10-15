import { $ } from './ui';

const TABS = ['message', 'rotation', 'quotes', 'settings'] as const;
type Tab = (typeof TABS)[number];

const fromHash = (): Tab => TABS.find((t) => `#${t}` === location.hash) ?? 'message';

/** Bottom tab bar: shows one panel at a time and remembers it in the URL hash, so a reload keeps your place. */
export function setupTabs(onShow: () => void): void {
  const show = (tab: Tab) => {
    for (const btn of document.querySelectorAll<HTMLElement>('[data-tab]')) btn.setAttribute('aria-selected', String(btn.dataset.tab === tab));
    for (const panel of document.querySelectorAll<HTMLElement>('[data-panel]')) panel.hidden = panel.dataset.panel !== tab;
    onShow(); // canvases in a hidden panel measure 0x0, so they need to re-measure once visible
  };
  $('#tabs').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!btn) return;
    history.replaceState(null, '', `#${btn.dataset.tab}`);
    show(btn.dataset.tab as Tab);
  });
  window.addEventListener('hashchange', () => show(fromHash()));
  show(fromHash());
}
