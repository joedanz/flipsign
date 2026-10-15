import type { Override, RotationEntry, Settings, StoredQuote } from '../../server/store/state';

export interface ViewInfo {
  grid: string;
  mode: 'override' | 'rotation';
  entryId: string | null;
  label: string;
  expiresAt: number | null;
  nextAt: number | null;
}

export interface StateResponse {
  settings: Settings;
  rotation: RotationEntry[];
  quotes: StoredQuote[];
  starterQuoteCount: number;
  starterQuotes: StoredQuote[];
  disabledQuotes: string[];
  override: Override | null;
  view: ViewInfo;
  serverNow: number;
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
