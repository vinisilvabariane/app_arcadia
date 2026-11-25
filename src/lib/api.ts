import { mockCall } from '../data/mock';
import type { ApiConsole, ApiFile } from '../types';

/* Ponte com o Apps Script que lê as pastas do Drive.
   Dá pra trocar a URL (ou ligar os dados de exemplo) pelo .env.local — veja .env.example. */
const DEFAULT_API_URL =
  'https://script.google.com/macros/s/AKfycbzZT2w0NCkyrzPd_eQkxVF-6Qi5zayIvhWPiZfi6AaybWnDWKa6KF4-zZVLcTw3TBWqKQ/exec';

const API_URL: string = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === '1';

const TIMEOUT_MS = 120_000;

async function call<T>(fn: string, a?: string | boolean, b?: string | boolean): Promise<T> {
  if (USE_MOCK) return mockCall(fn, a) as Promise<T>;

  let url = API_URL + '?fn=' + encodeURIComponent(fn);
  if (a !== undefined) url += '&a=' + encodeURIComponent(a);
  if (b !== undefined) url += '&b=' + encodeURIComponent(b);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error(j.error);
    return j as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  /** force = manda o Apps Script esquecer o cache e reler o Drive */
  consoles: (force = false) => call<ApiConsole[]>(force ? 'clearCache' : 'getConsoles', false),
  games: (consoleId: string) => call<ApiFile[]>('getGames', consoleId, false),
};
