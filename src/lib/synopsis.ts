import type { Game } from '../types';
import { coverWords, nearWord } from './covers';
import { norm, storage } from './format';

/* Sinopse: resumo do jogo na Wikipédia (português; se não achar, inglês).
   Só aceita o artigo se for de jogo e o título bater com o nome da ROM.
   Fica guardado no navegador por 30 dias. */

export interface Synopsis {
  text: string;
  title: string;
  lang: 'pt' | 'en';
  url: string;
}

const TTL = 30 * 864e5;
const MISS_TTL = 7 * 864e5;
const inflight: Record<string, Promise<Synopsis | null>> = {};

// nomes em japonês/chinês/coreano entre parênteses: "(クロノ・トリガー, Kurono Torigā)"
const CJK_PAREN = /\s*\([^)]*[぀-ヿ㐀-鿿가-힯][^)]*\)/g;

function wordsOk(gameTitle: string, wikiTitle: string): boolean {
  const want = coverWords(gameTitle).filter((w) => w.length > 1 || /\d/.test(w));
  const have = coverWords(wikiTitle);
  if (!want.length) return false;
  const miss = want.filter((w) => !have.some((h) => nearWord(w, h))).length;
  return miss === 0 || (want.length >= 3 && miss === 1);
}

interface WikiPage {
  index: number;
  title: string;
  description?: string;
  extract?: string;
}

function isGame(p: WikiPage, lang: 'pt' | 'en'): boolean {
  if (/^(lista|list of)\b/i.test(p.title)) return false;
  const d = (p.description || '') + ' ' + (p.extract || '').slice(0, 220);
  return lang === 'pt'
    ? /jogo eletr|videojogo|jogo de (v[ií]deo|computador|luta|plataforma|a[cç][aã]o|rpg|corrida)|rpg eletr/i.test(d)
    : /video game|videogame/i.test(d);
}

const clean = (t: string) =>
  String(t).replace(CJK_PAREN, '').replace(/\s*\(\s*\)/g, '').replace(/\s+([,.])/g, '$1').replace(/\s{2,}/g, ' ').trim();

async function search(title: string, lang: 'pt' | 'en'): Promise<Synopsis | null> {
  const extra = lang === 'pt' ? ' jogo eletrônico' : ' video game';
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=5` +
    `&gsrsearch=${encodeURIComponent(title + extra)}` +
    '&prop=extracts|description&exintro=1&explaintext=1&exsentences=5&exlimit=5';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Wikipédia ' + r.status);
  const j = await r.json();
  const pages: WikiPage[] = j.query?.pages ? Object.values(j.query.pages) : [];
  pages.sort((a, b) => a.index - b.index);
  const pg = pages.find((p) => p.extract && isGame(p, lang) && wordsOk(title, p.title));
  if (!pg) return null;
  return {
    text: clean(pg.extract!),
    title: pg.title,
    lang,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pg.title.replace(/ /g, '_'))}`,
  };
}

export function getSynopsis(g: Game): Promise<Synopsis | null> {
  const k = 'arc-sinopse-v1:' + norm(g.title);
  const c = storage.get<{ t: number; d: Synopsis | null } | null>(k, null);
  if (c && Date.now() - c.t < (c.d ? TTL : MISS_TTL)) return Promise.resolve(c.d);
  if (!inflight[k]) {
    inflight[k] = search(g.title, 'pt')
      .then((d) => d || search(g.title, 'en'))
      .then((d) => {
        storage.set(k, { t: Date.now(), d });
        return d;
      })
      .finally(() => delete inflight[k]);
  }
  return inflight[k];
}

export const wikiSearchUrl = (g: Game) =>
  'https://pt.wikipedia.org/w/index.php?search=' + encodeURIComponent(g.title + ' jogo');
