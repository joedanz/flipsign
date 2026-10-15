export function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing element ${selector}`);
  return el;
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ENTITIES[c]!);

/** Set a control's value unless the user is currently typing in it. */
export function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string): void {
  if (document.activeElement !== el) el.value = value;
}

let toastTimer = 0;
export function toast(message: string, isError = false): void {
  const el = $('#toast');
  el.textContent = message;
  el.className = isError ? 'show error' : 'show';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.className = ''), 3500);
}

/** Run an action; show any error as a toast. Resolves true on success. */
export async function attempt(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err) {
    toast((err as Error).message, true);
    return false;
  }
}
