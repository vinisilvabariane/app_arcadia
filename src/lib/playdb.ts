import { ROM_CACHE_LIMIT, ROM_CACHE_LIMITS } from '../data/play';
import { storage } from './format';

/* Banco local do "Jogar" (IndexedDB "arcadia-play"), com duas gavetas separadas:

   roms   cache das ROMs baixadas do Drive. Tem limite de tamanho: quando enche, saem as que
          foram jogadas há mais tempo. Pode ser apagado sem dó, é só baixar de novo.
   saves  saves de bateria e save states. NUNCA são apagados pela limpeza do cache. */

const DB_NAME = 'arcadia-play';
const ROMS = 'roms';
const SAVES = 'saves';

export interface RomEntry {
  /** id do arquivo no Drive */
  id: string;
  name: string;
  size: number;
  blob: Blob;
  lastPlayed: number;
  plays: number;
}
export type RomInfo = Omit<RomEntry, 'blob'>;

export type SaveKind = 'sram' | 'state';
export interface SaveEntry {
  /** "<id do Drive>:<tipo>:<slot>" */
  id: string;
  gameId: string;
  kind: SaveKind;
  slot: number;
  data: Uint8Array;
  updated: number;
  /** nome do jogo, só pra mostrar na lista e no backup */
  title: string;
  screenshot?: Uint8Array;
}
export type SaveInfo = Omit<SaveEntry, 'data' | 'screenshot'> & { size: number };

export const playSupported = (): boolean => typeof indexedDB !== 'undefined' && typeof WebAssembly === 'object';

let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ROMS, { keyPath: 'id' });
      req.result.createObjectStore(SAVES, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // se abrir falhou, a próxima chamada tenta de novo
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

/** Roda uma operação numa gaveta e espera a transação terminar de verdade (gravada em disco). */
async function run<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = op(tx.objectStore(store));
    tx.oncomplete = () => resolve((req ? req.result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException('Transação cancelada', 'AbortError'));
  });
}

/* ------------------------------------------------------------------ preferências */

const LIMIT_KEY = 'arc-play-limite';
const NO_CACHE_KEY = 'arc-play-sem-cache';

export function getRomLimit(): number {
  const saved = storage.get<number>(LIMIT_KEY, ROM_CACHE_LIMIT);
  return ROM_CACHE_LIMITS.some(([v]) => v === saved) ? saved : ROM_CACHE_LIMIT;
}
/** Muda o limite e já tira do cache o que passou dele. */
export async function setRomLimit(limit: number): Promise<void> {
  storage.set(LIMIT_KEY, limit);
  await makeRoom(0, limit);
}
/** "Jogar e descartar": não guarda nenhuma ROM. */
export const getNoCache = (): boolean => storage.get<boolean>(NO_CACHE_KEY, false);
export const setNoCache = (on: boolean): void => storage.set(NO_CACHE_KEY, on);

let askedPersist = false;
/** Pede pro navegador não apagar os dados do site quando o disco apertar (uma vez por visita). */
export function requestPersist(): void {
  if (askedPersist) return;
  askedPersist = true;
  navigator.storage?.persist?.().catch(() => {});
}

/* ------------------------------------------------------------------ cache de ROMs */

const info = ({ blob: _blob, ...rest }: RomEntry): RomInfo => rest;

/** O que está no cache, da jogada mais recente pra mais antiga (sem carregar os arquivos). */
export async function listRoms(): Promise<RomInfo[]> {
  const all = await run<RomEntry[]>(ROMS, 'readonly', (s) => s.getAll());
  return all.map(info).sort((a, b) => b.lastPlayed - a.lastPlayed);
}

/** Pega a ROM do cache (ou undefined) e marca que foi jogada agora. */
export async function getRom(id: string): Promise<RomEntry | undefined> {
  try {
    const rom = await run<RomEntry | undefined>(ROMS, 'readonly', (s) => s.get(id));
    if (!rom || !(rom.blob instanceof Blob) || !rom.blob.size) return undefined;
    const touched = { ...rom, lastPlayed: Date.now(), plays: (rom.plays || 0) + 1 };
    run(ROMS, 'readwrite', (s) => s.put(touched)).catch(() => {});
    return touched;
  } catch {
    return undefined; // cache quebrado nunca impede de jogar: baixa de novo
  }
}

export const removeRom = (id: string): Promise<void> => run(ROMS, 'readwrite', (s) => s.delete(id));
export const clearRoms = (): Promise<void> => run(ROMS, 'readwrite', (s) => s.clear());

/** Abre espaço pra `need` bytes dentro de `limit`, tirando as ROMs jogadas há mais tempo.
    `keep` nunca sai (é a que está sendo jogada). Devolve quantos bytes ficaram ocupados. */
async function makeRoom(need: number, limit: number, keep?: string): Promise<number> {
  const roms = await listRoms();
  let used = roms.reduce((n, r) => n + r.size, 0);
  // da mais antiga pra mais nova
  for (const rom of roms.reverse()) {
    if (used + need <= limit) break;
    if (rom.id === keep) continue;
    await removeRom(rom.id);
    used -= rom.size;
  }
  return used;
}

export type PutResult = 'saved' | 'too-big' | 'no-space' | 'failed';

/** Guarda uma ROM no cache respeitando o limite. Nunca lança erro: se não der, o jogo roda
    do mesmo jeito, só não fica guardado.
      too-big   a ROM sozinha é maior que o limite
      no-space  o navegador não tem espaço livre suficiente
      failed    o navegador recusou gravar */
export async function putRom(rom: Omit<RomEntry, 'lastPlayed' | 'plays'>, limit = getRomLimit()): Promise<PutResult> {
  try {
    if (rom.size > limit) return 'too-big';
    await removeRom(rom.id); // regravando a mesma ROM: a cópia velha não conta no espaço
    const used = await makeRoom(rom.size, limit, rom.id);
    if (used + rom.size > limit) return 'too-big'; // só sobrou a que está em jogo e ainda não cabe

    // O limite é nosso; o espaço de verdade quem dá é o navegador.
    const est = await navigator.storage?.estimate?.().catch(() => undefined);
    if (est?.quota && est.usage != null && est.quota - est.usage < rom.size * 1.1) {
      // tenta liberar o próprio cache antes de desistir
      await makeRoom(0, Math.max(0, used - rom.size), rom.id);
      const again = await navigator.storage.estimate().catch(() => undefined);
      if (again?.quota && again.usage != null && again.quota - again.usage < rom.size * 1.1) return 'no-space';
    }

    await run(ROMS, 'readwrite', (s) => s.put({ ...rom, lastPlayed: Date.now(), plays: 1 } satisfies RomEntry));
    return 'saved';
  } catch (err) {
    console.warn('cache de ROMs', err);
    return err instanceof DOMException && err.name === 'QuotaExceededError' ? 'no-space' : 'failed';
  }
}

/** Limpeza leve: tira entradas sem arquivo ou com tamanho que não bate. */
export async function cleanRoms(): Promise<void> {
  try {
    const all = await run<RomEntry[]>(ROMS, 'readonly', (s) => s.getAll());
    for (const rom of all) {
      if (!(rom.blob instanceof Blob) || !rom.blob.size || rom.blob.size !== rom.size) await removeRom(rom.id);
    }
  } catch {
    /* sem banco: nada pra limpar */
  }
}

/* ------------------------------------------------------------------ saves */

export const saveId = (gameId: string, kind: SaveKind, slot = 0) => gameId + ':' + kind + ':' + slot;

export async function getSave(gameId: string, kind: SaveKind, slot = 0): Promise<SaveEntry | undefined> {
  try {
    return await run<SaveEntry | undefined>(SAVES, 'readonly', (s) => s.get(saveId(gameId, kind, slot)));
  } catch {
    return undefined;
  }
}

export function putSave(save: Omit<SaveEntry, 'id' | 'updated'> & { updated?: number }): Promise<void> {
  const entry: SaveEntry = { ...save, id: saveId(save.gameId, save.kind, save.slot), updated: save.updated ?? Date.now() };
  return run(SAVES, 'readwrite', (s) => void s.put(entry));
}

export const removeSave = (id: string): Promise<void> => run(SAVES, 'readwrite', (s) => s.delete(id));

export async function listSaves(): Promise<SaveInfo[]> {
  const all = await run<SaveEntry[]>(SAVES, 'readonly', (s) => s.getAll());
  return all
    .map(({ data, screenshot: _shot, ...rest }) => ({ ...rest, size: data?.byteLength || 0 }))
    .sort((a, b) => b.updated - a.updated);
}

/* ---- backup: um .json com todos os saves (os bytes vão em base64) ---- */

function toBase64(bytes: Uint8Array): string {
  let out = '';
  // em pedaços: String.fromCharCode com milhões de argumentos estoura a pilha
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface Backup {
  app: 'arcadia-saves';
  version: 1;
  exported: number;
  saves: (Omit<SaveEntry, 'data' | 'screenshot'> & { data: string; screenshot?: string })[];
}

export async function exportSaves(): Promise<{ blob: Blob; count: number }> {
  const all = await run<SaveEntry[]>(SAVES, 'readonly', (s) => s.getAll());
  const backup: Backup = {
    app: 'arcadia-saves',
    version: 1,
    exported: Date.now(),
    saves: all.map(({ data, screenshot, ...rest }) => ({
      ...rest,
      data: toBase64(data),
      ...(screenshot ? { screenshot: toBase64(screenshot) } : {}),
    })),
  };
  return { blob: new Blob([JSON.stringify(backup)], { type: 'application/json' }), count: all.length };
}

/** Lê um backup. Um save só substitui o que já existe se for mais novo.
    Devolve quantos entraram e quantos foram ignorados (mais antigos que os daqui). */
export async function importSaves(file: Blob): Promise<{ added: number; skipped: number }> {
  let backup: Backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('Esse arquivo não é um backup de saves do Arcádia.');
  }
  if (backup?.app !== 'arcadia-saves' || !Array.isArray(backup.saves)) throw new Error('Esse arquivo não é um backup de saves do Arcádia.');

  let added = 0;
  let skipped = 0;
  for (const s of backup.saves) {
    if (typeof s?.gameId !== 'string' || (s.kind !== 'sram' && s.kind !== 'state') || typeof s.data !== 'string') continue;
    const slot = Number(s.slot) || 0;
    const mine = await getSave(s.gameId, s.kind, slot);
    if (mine && mine.updated >= (s.updated || 0)) {
      skipped++;
      continue;
    }
    await putSave({
      gameId: s.gameId,
      kind: s.kind,
      slot,
      title: String(s.title || ''),
      updated: Number(s.updated) || Date.now(),
      data: fromBase64(s.data),
      ...(s.screenshot ? { screenshot: fromBase64(s.screenshot) } : {}),
    });
    added++;
  }
  return { added, skipped };
}
