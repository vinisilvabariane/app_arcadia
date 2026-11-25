import type { Franchise, Game, GameConsole, SortKey } from '../types';
import { hasCover } from './covers';
import { hash } from './format';

export const downloadUrl = (g: Game) =>
  g.folder ? 'https://drive.google.com/drive/folders/' + g.id : 'https://drive.google.com/uc?export=download&id=' + g.id;
export const driveUrl = (g: Game) =>
  g.folder ? 'https://drive.google.com/drive/folders/' + g.id : 'https://drive.google.com/file/d/' + g.id + '/view';

/* A pasta RECOMPS do Drive não é um console: tem página própria (/recomps). */
export const isRecompsName = (name: string) => /^recomp(s|ilados?)?$/i.test(name.replace(/\([^)]*\)/g, '').trim());
let recompsId: string | null = null;
export const setRecompsId = (id: string | null) => void (recompsId = id);

/** caminho da página de um console (e subpasta) */
export const consolePath = (id: string, path: string[] = []) =>
  (id === recompsId ? '/recomps' : '/console/' + encodeURIComponent(id)) + path.map((p) => '/' + encodeURIComponent(p)).join('');

export function sortList(list: Game[], sort: SortKey): Game[] {
  const l = list.slice();
  if (sort === 'recent') l.sort((a, b) => b.updated - a.updated);
  else if (sort === 'size') l.sort((a, b) => b.size - a.size);
  else l.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  return l;
}

export const byNewest = (list: Game[], n: number) => list.slice().sort((a, b) => b.updated - a.updated).slice(0, n);
export const totalSize = (list: Game[]) => list.reduce((s, g) => s + g.size, 0);

/** DLC, update e patch não contam como "jogo" em sorteio e franquias */
export const isExtra = (g: Game) => /^(dlc|updates?|patch(es)?|atualiza)/i.test(g.path[0] || '');

/* Escolhe n jogos com capa olhando só uma amostra da lista (no máximo 60 jogos),
   em vez de procurar a capa de todos: com milhares de ROMs isso travava a tela. */
export function pickCovers(list: Game[], n: number, seed = 0): Game[] {
  const len = list.length;
  const out: Game[] = [];
  if (!len) return out;
  const start = (hash(list[0].consoleId) + seed) % len;
  const step = Math.max(1, Math.floor(len / Math.max(n * 6, 1)));
  for (let i = 0; out.length < n && i < Math.min(len, 60); i++) {
    const g = list[(start + i * step + Math.floor((i * step) / len)) % len];
    if (!out.includes(g) && hasCover(g)) out.push(g);
  }
  for (let i = 0; out.length < n && i < len; i++) {
    const g = list[(start + i) % len];
    if (!out.includes(g)) out.push(g);
  }
  return out;
}

/** Ordem das fileiras: com capa primeiro, depois os mais recentes (olha só os 150 mais recentes). */
export function rowOrder(list: Game[]): Game[] {
  const l = list.length > 150 ? byNewest(list, 150) : list.slice();
  return l.sort((a, b) => Number(hasCover(b)) - Number(hasCover(a)) || b.updated - a.updated);
}

export function inPath(g: Game, path: string[]): boolean {
  if (g.path.length < path.length) return false;
  return path.every((p, i) => g.path[i] === p);
}

export interface Subfolder {
  name: string;
  items: Game[];
}
export function subfolders(list: Game[], path: string[]): Subfolder[] {
  const map = new Map<string, Subfolder>();
  list.forEach((g) => {
    if (g.path.length <= path.length) return;
    const name = g.path[path.length];
    if (!map.has(name)) map.set(name, { name, items: [] });
    map.get(name)!.items.push(g);
  });
  // Pastas de jogos primeiro (Jogos, Games, ROMs), depois o resto em ordem alfabética.
  const rank = (n: string) => (/^(jogos?|games?|roms?)$/i.test(n) ? 0 : 1);
  return [...map.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'pt-BR'));
}

const franchiseKeys = new WeakMap<Game, string>();
function franchiseKey(g: Game): string {
  let k = franchiseKeys.get(g);
  if (k == null) {
    k = ' ' + (g.title + ' ' + g.base).toLowerCase().normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-z0-9]+/g, ' ') + ' ';
    franchiseKeys.set(g, k);
  }
  return k;
}
export const franchiseGames = (all: Game[], f: Franchise) =>
  all.filter((g) => !g.folder && !isExtra(g) && f.re.test(franchiseKey(g)));

/** consoles (sem repetir) dos jogos de uma lista, na ordem em que aparecem */
export function consolesOf(list: Game[], byId: Record<string, GameConsole>): GameConsole[] {
  const seen = new Set<string>();
  const out: GameConsole[] = [];
  list.forEach((g) => {
    if (seen.has(g.consoleId) || !byId[g.consoleId]) return;
    seen.add(g.consoleId);
    out.push(byId[g.consoleId]);
  });
  return out;
}

export function searchGames(all: Game[], q: string): Game[] {
  const terms = q.toLowerCase().split(/\s+/).map((t) => t.normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-z0-9]/g, '')).filter(Boolean);
  return all.filter((g) => terms.every((t) => g.searchKey.includes(t)));
}
