import type { Game } from '../types';
import { storage } from './format';

/* Capas: busca por semelhança no acervo do libretro-thumbnails.
   Para cada console, baixamos uma vez a lista de nomes das capas (API do GitHub)
   e guardamos no navegador. Aí comparamos os nomes "simplificados":
   sem maiúsculas, acentos, pontuação, região, "The"/"A" e sem o "I" final. */

interface CoverIndex {
  map: Record<string, string[]>;
  keys: string[];
  words?: { key: string; w: string[] }[];
  byWord?: Record<string, number[]>;
}

/** sistema -> índice | 'loading' | null (não deu pra baixar) */
const COVER_IDX: Record<string, CoverIndex | 'loading' | null> = {};
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
let matchTimer: ReturnType<typeof setTimeout>;

function matchMem(sys: string) {
  if (!MATCH_MEM[sys]) MATCH_MEM[sys] = storage.get<Record<string, string>>('arc-match-v1:' + sys, {});
  return MATCH_MEM[sys];
}
function saveMatchMem(sys: string) {
  matchDirty[sys] = 1;
  clearTimeout(matchTimer);
  matchTimer = setTimeout(() => {
    Object.keys(matchDirty).forEach((k) => storage.set('arc-match-v1:' + k, MATCH_MEM[k]));
    matchDirty = {};
  }, 1500);
}

function loadedIdx(sys: string | null): CoverIndex | null {
  const idx = sys ? COVER_IDX[sys] : null;
  return idx && idx !== 'loading' ? idx : null;
}

/** Nome da capa no acervo, ou null. Só funciona depois que a lista do console carregou. */
function findCover(g: Game): string | null {
  const idx = loadedIdx(g.sys);
  if (!idx || !g.sys) return null;
  const mem = matchMem(g.sys);
  if (Object.prototype.hasOwnProperty.call(mem, g.base)) return mem[g.base] || null;
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
  return !loadedIdx(g.sys) || !!findCover(g);
}

/* As capas originais são PNGs grandes (centenas de KB cada). Passamos pelo wsrv.nl,
   um redimensionador público e gratuito, que devolve WebP do tamanho certo (~10–20 KB).
   Se ele falhar, a imagem cai no PNG original. */
const IMG_PROXY = 'https://wsrv.nl/?url=';
const sized = (raw: string, w: number, extra = '') => IMG_PROXY + encodeURIComponent(raw) + '&w=' + w + '&output=webp&q=72' + extra;

/** URLs a tentar, em ordem. w = largura em px; blur = imagem minúscula pra fundo desfocado. */
export function coverUrls(g: Game, w = 320, blur = false): string[] {
  if (!g.sys) return [];
  if (COVER_IDX[g.sys] === 'loading') return []; // espera a lista: evita dezenas de tentativas que dão 404
  const repo = 'https://raw.githubusercontent.com/libretro-thumbnails/' + repoName(g.sys) + '/master/Named_Boxarts/';
  const raw = (n: string) => repo + encodeURIComponent(n.replace(/[&*/:`<>?\\|"]/g, '_')) + '.png';
  const px = (n: string) => (blur ? sized(raw(n), 64, '&blur=2') : sized(raw(n), w));
  if (loadedIdx(g.sys)) {
    // Lista carregada: usa só o que existe de verdade no acervo (versão leve, depois a original).
    const hit = findCover(g);
    return hit ? (blur ? [px(hit)] : [px(hit), raw(hit)]) : [];
  }
  // Lista indisponível: tenta o nome exato e variações com região (só versões leves).
  const clean = g.base.replace(TAGS_RE, '').trim();
  return [...new Set([g.base, clean + ' (USA)', clean + ' (World)', clean + ' (Europe)', clean + ' (Japan)'])].map(px);
}

async function fetchCoverNames(sys: string): Promise<string[]> {
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

/** Carrega (do cache ou do GitHub) a lista de capas de cada sistema. onChange avisa a tela pra redesenhar. */
export function loadCoverIndexes(systems: string[], onChange: () => void): void {
  const queue: string[] = [];
  [...new Set(systems)].forEach((sys) => {
    if (COVER_IDX[sys]) return;
    const cached = storage.get<{ t: number; names: string } | null>('arc-capas-v1:' + sys, null);
    if (cached && Date.now() - cached.t < COVER_CACHE_DAYS * 864e5) {
      COVER_IDX[sys] = buildCoverIdx(cached.names.split('\n'));
    } else {
      COVER_IDX[sys] = 'loading';
      queue.push(sys);
    }
  });
  const next = (): void => {
    const sys = queue.shift();
    if (!sys) return;
    fetchCoverNames(sys)
      .then((names) => {
        storage.set('arc-capas-v1:' + sys, { t: Date.now(), names: names.join('\n') });
        MATCH_MEM[sys] = {};
        storage.remove('arc-match-v1:' + sys);
        COVER_IDX[sys] = buildCoverIdx(names);
      })
      .catch((e) => {
        console.warn('capas', sys, e);
        COVER_IDX[sys] = null;
      })
      .then(() => {
        onChange();
        next();
      });
  };
  // baixa no máximo 3 listas ao mesmo tempo
  next();
  next();
  next();
}
