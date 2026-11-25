import type { Game } from '../types';
import { storage } from './format';

/* Capas: busca por semelhança no acervo do libretro-thumbnails.
   Para cada console existe uma lista com os nomes das capas. Comparamos os nomes
   "simplificados": sem maiúsculas, acentos, pontuação, região, "The"/"A" e sem o "I" final.

   A capa que casou com cada jogo fica guardada no navegador. Então a lista de um console
   (centenas de KB) só é baixada quando aparece um jogo que ainda não foi resolvido:
   na primeira visita, ou quando entra jogo novo no acervo. */

interface CoverIndex {
  map: Record<string, string[]>;
  keys: string[];
  words?: { key: string; w: string[] }[];
  byWord?: Record<string, number[]>;
}

/** Lista de nomes de um sistema; o índice de busca só é montado quando alguém precisa dele. */
interface Loaded {
  names: string[];
  idx?: CoverIndex;
}
/** sistema -> lista carregada | 'loading' | null (não deu pra baixar). Sem entrada = ninguém pediu ainda. */
const COVER_IDX: Record<string, Loaded | 'loading' | null> = {};
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const COVER_CACHE_DAYS = 14;
const TAGS_RE = /\s*[([][^)\]]*[)\]]/g;

const repoName = (sys: string) => sys.replace(/ /g, '_');

function coverKey(s: string): string {
  s = String(s).replace(/\.png$/i, '').replace(TAGS_RE, ' ').replace(/&/g, ' and ');
  s = s.toLowerCase().normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/_/g, ' ');
  s = s.replace(/\b(the|a|an)\b/g, ' ');
  return s.replace(/[^a-z0-9]/g, '');
}

export function coverWords(s: string): string[] {
  s = String(s).replace(/\.png$/i, '').replace(TAGS_RE, ' ').replace(/&/g, ' and ').replace(/'/g, '');
  s = s.toLowerCase().normalize('NFD').replace(/[^\x00-\x7F]/g, '');
  return s.split(/[^a-z0-9]+/).filter((w) => w && w !== 'the' && w !== 'a' && w !== 'an');
}

/** iguais, ou com 1 letra de diferença em palavras longas */
export function nearWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function regionScore(name: string): number {
  let s = /\(USA/.test(name) ? 0 : /\(World/.test(name) ? 1 : /\(Brazil/.test(name) ? 2 : /Europe/.test(name) ? 3 : /Japan/.test(name) ? 4 : 5;
  if (/\((Beta|Proto|Demo|Sample|Pirate|Unl|Aftermarket)/i.test(name)) s += 10;
  if (/Switch Online|Virtual Console|Collection/i.test(name)) s += 1;
  return s;
}
const bestOf = (list: string[]) => list.slice().sort((a, b) => regionScore(a) - regionScore(b) || a.length - b.length)[0];

function buildCoverIdx(names: string[]): CoverIndex {
  const map: Record<string, string[]> = Object.create(null); // sem protótipo: nomes como "constructor" não quebram
  const keys: string[] = [];
  names.forEach((n) => {
    const k = coverKey(n);
    if (!k) return;
    if (!map[k]) {
      map[k] = [];
      keys.push(k);
    }
    map[k].push(n.replace(/\.png$/i, ''));
  });
  keys.sort();
  return { map, keys };
}

/* Por palavras: todas as palavras do seu nome precisam aparecer no nome do acervo.
   Ganha o que tiver menos palavras sobrando. */
function wordMatch(idx: CoverIndex, name: string): string | null {
  const want = coverWords(name);
  if (!want.length) return null;
  if (!idx.words) {
    idx.words = idx.keys.map((k) => ({ key: k, w: coverWords(idx.map[k][0]) }));
    const byWord: Record<string, number[]> = Object.create(null);
    idx.words.forEach((e, i) => e.w.forEach((w) => (byWord[w] || (byWord[w] = [])).push(i)));
    idx.byWord = byWord;
  }
  const words = idx.words;
  // candidatos: nomes que contêm a palavra mais rara do seu nome; se nenhuma existir igual, varre tudo
  let pool: number[] | null = null;
  want.forEach((w) => {
    const l = idx.byWord![w];
    if (l && (!pool || l.length < pool.length)) pool = l;
  });
  const cands = pool ? (pool as number[]).map((i) => words[i]) : words;
  let best: string | null = null;
  let bestExtra = 99;
  cands.forEach((e) => {
    if (e.w.length - want.length >= bestExtra || e.w.length < want.length) return;
    const used: number[] = [];
    for (const w of want) {
      let ok = false;
      for (let j = 0; j < e.w.length; j++) {
        if (!used.includes(j) && nearWord(w, e.w[j])) {
          used.push(j);
          ok = true;
          break;
        }
      }
      if (!ok) return;
    }
    const extra = e.w.length - want.length;
    if (extra < bestExtra) {
      bestExtra = extra;
      best = e.key;
    }
  });
  return best && bestExtra <= 4 ? bestOf(idx.map[best]) : null;
}

/* Guarda no navegador qual capa casou com cada nome, pra não refazer a busca na próxima visita. */
const MATCH_MEM: Record<string, Record<string, string>> = {};
let matchDirty: Record<string, 1> = {};
let matchTimer: ReturnType<typeof setTimeout> | undefined;

function matchMem(sys: string) {
  if (!MATCH_MEM[sys]) MATCH_MEM[sys] = storage.get<Record<string, string>>('arc-match-v1:' + sys, {});
  return MATCH_MEM[sys];
}
function saveMatchMem(sys: string) {
  matchDirty[sys] = 1;
  // grava no máximo a cada 1,5 s (e não a cada jogo resolvido)
  matchTimer ??= setTimeout(() => {
    matchTimer = undefined;
    Object.keys(matchDirty).forEach((k) => storage.set('arc-match-v1:' + k, MATCH_MEM[k]));
    matchDirty = {};
  }, 1500);
}
function forgetMatches(sys: string) {
  MATCH_MEM[sys] = {};
  storage.remove('arc-match-v1:' + sys);
}

function loadedIdx(sys: string | null): CoverIndex | null {
  const entry = sys ? COVER_IDX[sys] : null;
  if (!entry || entry === 'loading') return null;
  return (entry.idx ??= buildCoverIdx(entry.names));
}

/** Capa do jogo: o nome dela no acervo, null (não tem) ou undefined (ainda não dá pra saber:
    a lista do console está a caminho, ou não deu pra baixar). */
function findCover(g: Game): string | null | undefined {
  if (!g.sys) return null;
  const mem = matchMem(g.sys);
  if (own(mem, g.base)) return mem[g.base] || null; // já resolvido: nem precisa da lista
  const idx = loadedIdx(g.sys);
  if (!idx) {
    needList(g.sys);
    return undefined;
  }
  const clean = g.base.replace(TAGS_RE, '').trim();
  const tries = [coverKey(clean)];
  if (/\s(I|1)$/i.test(clean)) tries.push(coverKey(clean.replace(/\s(I|1)$/i, '')));
  let hit: string | null = null;
  for (let i = 0; i < tries.length && !hit; i++) if (idx.map[tries[i]]) hit = bestOf(idx.map[tries[i]]);
  if (!hit) hit = wordMatch(idx, clean);
  mem[g.base] = hit || '';
  saveMatchMem(g.sys);
  return hit;
}

/** Tem (ou provavelmente tem) capa? Enquanto a lista não chega, assume que sim. */
export function hasCover(g: Game): boolean {
  if (!g.sys || g.folder) return false;
  return findCover(g) !== null;
}

/* As capas originais são PNGs grandes (centenas de KB cada). Passamos pelo wsrv.nl,
   um redimensionador público e gratuito, que devolve WebP do tamanho certo (~10–20 KB).
   Se ele falhar, fica o cartão colorido: cair no PNG original fazia o navegador
   decodificar centenas de imagens enormes e travava a página. */
const IMG_PROXY = 'https://wsrv.nl/?url=';
const sized = (raw: string, w: number, extra = '') => IMG_PROXY + encodeURIComponent(raw) + '&w=' + w + '&output=webp&q=72' + extra;

/** URLs a tentar, em ordem. w = largura em px; blur = imagem minúscula pra fundo desfocado. */
export function coverUrls(g: Game, w = 320, blur = false): string[] {
  if (!g.sys) return [];
  const repo = 'https://raw.githubusercontent.com/libretro-thumbnails/' + repoName(g.sys) + '/master/Named_Boxarts/';
  const raw = (n: string) => repo + encodeURIComponent(n.replace(/[&*/:`<>?\\|"]/g, '_')) + '.png';
  const px = (n: string) => (blur ? sized(raw(n), 64, '&blur=2') : sized(raw(n), w));
  const hit = findCover(g);
  if (hit) return [px(hit)]; // só o que existe de verdade no acervo
  // sem capa, ou a lista ainda está chegando (esperar evita dezenas de tentativas que dão 404)
  if (hit === null || COVER_IDX[g.sys] !== null) return [];
  // Lista indisponível: tenta só o nome exato e a versão americana (poucas tentativas, pra não encher a rede de 404).
  const clean = g.base.replace(TAGS_RE, '').trim();
  return [...new Set([g.base, clean + ' (USA)'])].map(px);
}

/* De onde vêm as listas de nomes:
   1. covers/<sistema>.json, gerado no build (scripts/fetch-covers.mjs) e servido pelo próprio site.
      Sem limite de requisições e com cache do navegador.
   2. Reserva: API do GitHub, guardada no localStorage por 14 dias. Ela aceita só 60 chamadas
      por hora por IP — numa rede compartilhada estoura fácil, por isso não é mais o caminho principal. */
async function fetchStatic(sys: string): Promise<string[] | null> {
  try {
    const r = await fetch(import.meta.env.BASE_URL + 'covers/' + encodeURIComponent(repoName(sys)) + '.json');
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    const names = await r.json();
    return Array.isArray(names) ? names : null;
  } catch {
    return null;
  }
}

async function fetchFromGitHub(sys: string): Promise<string[]> {
  const apiUrl = 'https://api.github.com/repos/libretro-thumbnails/' + repoName(sys) + '/git/trees/';
  const json = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('GitHub ' + r.status);
    return r.json();
  };
  const root = await json(apiUrl + 'master');
  const bx = (root.tree as { path: string; sha: string }[]).find((e) => e.path === 'Named_Boxarts');
  if (!bx) return [];
  const sub = await json(apiUrl + bx.sha);
  return ((sub.tree || []) as { path: string }[]).map((e) => e.path).filter((p) => /\.png$/i.test(p));
}

async function loadNames(sys: string): Promise<string[]> {
  const fromSite = await fetchStatic(sys);
  if (fromSite) {
    storage.remove('arc-capas-v1:' + sys); // cópia antiga no localStorage não é mais necessária
    return fromSite;
  }
  const cached = storage.get<{ t: number; names: string } | null>('arc-capas-v1:' + sys, null);
  if (cached && Date.now() - cached.t < COVER_CACHE_DAYS * 864e5) return cached.names.split('\n');
  const names = await fetchFromGitHub(sys);
  storage.set('arc-capas-v1:' + sys, { t: Date.now(), names: names.join('\n') });
  return names;
}

/* Assinatura de uma lista (quantidade:soma dos tamanhos). O script do build grava a mesma conta
   em covers/manifest.json; é assim que o site percebe que uma lista mudou sem precisar baixá-la. */
const signature = (names: string[]) => names.length + ':' + names.reduce((n, x) => n + x.length, 0);

let notify: () => void = () => {};
const queue: string[] = [];
let running = 0;

/** Pede a lista de um sistema (uma vez só). Quando ela chega, as telas são avisadas pra redesenhar. */
function needList(sys: string): void {
  if (own(COVER_IDX, sys)) return;
  COVER_IDX[sys] = 'loading';
  queue.push(sys);
  pump();
}

function pump(): void {
  while (running < 4 && queue.length) {
    const sys = queue.shift()!;
    running++;
    loadNames(sys)
      .then((names) => {
        // a lista mudou desde a última visita? então as capas já casadas podem estar velhas
        const sig = signature(names);
        if (storage.get<string>('arc-capas-sig:' + sys, '') !== sig) {
          forgetMatches(sys);
          storage.set('arc-capas-sig:' + sys, sig);
        }
        COVER_IDX[sys] = { names };
      })
      .catch((e) => {
        console.warn('capas', sys, e);
        COVER_IDX[sys] = null;
      })
      .then(() => {
        running--;
        notify();
        pump();
      });
  }
}

/** Liga o aviso de "chegou capa nova" e confere se alguma lista mudou desde a última visita. */
export function initCovers(onChange: () => void): void {
  notify = onChange;
  fetch(import.meta.env.BASE_URL + 'covers/manifest.json')
    .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
    .then((manifest: Record<string, string> | null) => {
      if (!manifest) return;
      let changed = false;
      for (const sys of Object.keys(manifest)) {
        const seen = storage.get<string>('arc-capas-sig:' + sys, '');
        if (!seen || seen === manifest[sys]) continue;
        // Lista nova no site: esquece o que estava casado e deixa resolver de novo com ela.
        forgetMatches(sys);
        storage.remove('arc-capas-sig:' + sys);
        if (COVER_IDX[sys] !== 'loading') delete COVER_IDX[sys];
        changed = true;
      }
      if (changed) notify();
    })
    .catch(() => {
      /* sem manifesto (ou sem rede): segue com o que já está guardado */
    });
}

/* Resolve em segundo plano a capa de todos os jogos, nos momentos em que o navegador está à toa.
   Depois disso tudo fica guardado e as próximas visitas não precisam de lista nenhuma. */
let warmRun = 0;
const whenIdle: (fn: (d?: IdleDeadline) => void) => void =
  typeof requestIdleCallback === 'function' ? (fn) => requestIdleCallback(fn, { timeout: 2000 }) : (fn) => setTimeout(fn, 60);

export function warmCovers(games: Game[]): void {
  const run = ++warmRun;
  let todo = games.filter((g) => g.sys && !own(matchMem(g.sys), g.base));
  if (!todo.length) return;
  const step = (deadline?: IdleDeadline): void => {
    if (run !== warmRun) return; // chegou um acervo mais novo: essa rodada não vale mais
    const until = performance.now() + 8;
    const waiting: Game[] = [];
    let i = 0;
    for (; i < todo.length; i++) {
      if (deadline ? deadline.timeRemaining() < 1 : performance.now() > until) break;
      // undefined = lista ainda chegando: tenta de novo depois (se a lista falhou, desiste desse jogo)
      if (findCover(todo[i]) === undefined && COVER_IDX[todo[i].sys!] !== null) waiting.push(todo[i]);
    }
    const rest = todo.slice(i);
    todo = waiting.concat(rest);
    if (!todo.length) return;
    // só sobrou jogo esperando lista? dá um tempo pra rede antes de olhar de novo
    if (rest.length) whenIdle(step);
    else setTimeout(() => whenIdle(step), 400);
  };
  whenIdle(step);
}
