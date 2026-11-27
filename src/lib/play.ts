import { DEV_ROM_URL, DRIVE_API_KEY, PLAY_CORES, type PlayCore } from '../data/play';
import type { Game } from '../types';
import { isExtra } from './games';
import { playSupported } from './playdb';

/* Regras do "Jogar" e o download da ROM direto da API do Drive. */

/** O recurso está ligado? (tem chave de API — ou arquivo de teste no modo dev — e o navegador dá conta) */
export const PLAY_ENABLED: boolean = (!!DRIVE_API_KEY || !!DEV_ROM_URL) && playSupported();

/** Núcleo que roda esse jogo, ou null se ele não ganha botão Jogar
    (console sem núcleo, pasta, DLC/update, ou a pasta RECOMPS, que não tem sigla de console). */
export function playCore(g: Game | undefined): PlayCore | null {
  if (!PLAY_ENABLED || !g || g.folder || isExtra(g)) return null;
  if (/^bios$/i.test(g.path[0] || '')) return null; // arquivo de BIOS não é jogo
  const core = PLAY_CORES[g.short];
  if (!core || (core.biosFile && (g.real || g.file).toLowerCase() === core.biosFile)) return null;
  return core;
}

export const playPath = (g: Game) => '/jogar/' + encodeURIComponent(g.key);

/** Erro com mensagem pronta pra mostrar e dica do que fazer. */
export class PlayError extends Error {
  /** dá pra tentar de novo com chance de funcionar? */
  retry: boolean;
  constructor(message: string, retry = true) {
    super(message);
    this.name = 'PlayError';
    this.retry = retry;
  }
}

export interface Progress {
  loaded: number;
  total: number;
  /** bytes por segundo (média desde o começo) */
  speed: number;
}

/* O endereço de download comum do Drive (uc?export=download) não serve aqui: não tem CORS e,
   em arquivo grande, devolve uma página de aviso em vez do arquivo. A API v3 com alt=media serve.
   Sem cabeçalhos extras (nem Authorization, nem Range): assim o navegador não faz a consulta
   prévia de CORS. */
export const romUrl = (id: string) =>
  DEV_ROM_URL || 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media&key=' + encodeURIComponent(DRIVE_API_KEY);

async function explain(res: Response): Promise<PlayError> {
  let reason = '';
  try {
    const body = await res.json();
    reason = String(body?.error?.errors?.[0]?.reason || body?.error?.status || '');
  } catch {
    /* resposta sem JSON */
  }
  if (res.status === 404) return new PlayError('O Drive não achou esse arquivo. Ele precisa estar compartilhado como "qualquer pessoa com o link".', false);
  if (res.status === 429 || /quota|rateLimit|downloadQuotaExceeded/i.test(reason))
    return new PlayError('O Drive limitou os downloads por agora. Tente mais tarde, ou use o botão Baixar.');
  if (res.status === 403) {
    if (/cannotDownloadAbusiveFile/i.test(reason)) return new PlayError('O Google marcou esse arquivo como suspeito e não deixa baixar por aqui. Use o botão Baixar.', false);
    return new PlayError('O Drive recusou o download (403). Confira se o arquivo está compartilhado por link e se a chave de API vale para este site.', false);
  }
  if (res.status === 400) return new PlayError('A chave de API do Drive não foi aceita (400).', false);
  return new PlayError('O Drive respondeu com erro ' + res.status + '.');
}

/** Baixa a ROM mostrando o progresso. Cancela com o `signal`. */
export async function downloadRom(g: Game, signal: AbortSignal, onProgress: (p: Progress) => void): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(romUrl(g.id), { signal });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new PlayError('Não deu pra falar com o Drive. Confira a internet e tente de novo.');
  }
  if (!res.ok) throw await explain(res);

  // se o Drive não disser o tamanho, vale o que veio na listagem
  const total = Number(res.headers.get('content-length')) || g.size || 0;
  const started = performance.now();
  if (!res.body?.getReader) return res.blob(); // navegador sem leitura em pedaços: sem barra de progresso

  const reader = res.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  let lastTick = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      loaded += value.length;
      const now = performance.now();
      if (now - lastTick > 120) {
        lastTick = now;
        onProgress({ loaded, total: Math.max(total, loaded), speed: loaded / Math.max(0.001, (now - started) / 1000) });
      }
    }
  } catch (err) {
    if (signal.aborted) throw err;
    throw new PlayError('A conexão caiu no meio do download. Tente de novo.');
  }
  if (!loaded) throw new PlayError('O Drive devolveu um arquivo vazio.');
  onProgress({ loaded, total: loaded, speed: loaded / Math.max(0.001, (performance.now() - started) / 1000) });
  return new Blob(parts);
}

/** Tela pequena e de toque: N64 e PS1 não dão conta. */
export const isSmallTouch = (): boolean => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
