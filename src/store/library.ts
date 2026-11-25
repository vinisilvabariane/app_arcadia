import { create } from 'zustand';
import { consoleInfo, isPtBr } from '../data/consoles';
import { api } from '../lib/api';
import { loadCoverIndexes } from '../lib/covers';
import { norm, parseName } from '../lib/format';
import { isRecompsName, setRecompsId } from '../lib/games';
import type { ApiFile, Game, GameConsole } from '../types';
import { useUi } from './ui';

interface LibraryState {
  /** todas as pastas da raiz do Drive (inclui RECOMPS) */
  consoles: GameConsole[];
  /** só os consoles de verdade: o que aparece em Consoles, Início e nos filtros */
  shelf: GameConsole[];
  /** id da pasta RECOMPS, se existir */
  recompsId: string | null;
  byId: Record<string, GameConsole>;
  /** todos os jogos já carregados, de todos os consoles */
  all: Game[];
  byKey: Record<string, Game>;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  /** true enquanto ainda tem console chegando do Drive */
  refreshing: boolean;
  /** muda quando uma lista de capas termina de carregar (as telas redesenham) */
  coverTick: number;
  /** semente da sessão: embaralha destaques de um jeito estável */
  seed: number;
  load: (force?: boolean) => Promise<void>;
}

function toGames(c: GameConsole, files: ApiFile[]): Game[] {
  return files.map((f) => {
    const p = parseName(f.file, f.folder);
    const path = f.path || [];
    return {
      id: f.id,
      key: f.id,
      file: f.file,
      size: f.size || 0,
      updated: f.updated,
      folder: !!f.folder,
      path,
      base: p.base,
      ext: p.ext,
      title: p.title,
      tags: p.tags.filter((t) => !/^[0-9a-f]{16}$/i.test(t)),
      consoleId: c.id,
      consoleName: c.name,
      short: c.info.short,
      color: c.info.color,
      sys: c.info.sys,
      pt: isPtBr(p.base) || c.ptbr,
      searchKey: norm([p.title, p.base, c.name, c.info.short, ...path].join(' ')),
    };
  });
}

const RECOMPS_INFO = { short: 'PC', color: '#7c5cff', sys: null };

let loadId = 0;
let coverTimer: ReturnType<typeof setTimeout>;

export const useLibrary = create<LibraryState>((set, get) => ({
  consoles: [],
  shelf: [],
  recompsId: null,
  byId: {},
  all: [],
  byKey: {},
  status: 'loading',
  error: null,
  refreshing: false,
  coverTick: 0,
  seed: Math.floor(Math.random() * 1e6),

  async load(force = false) {
    const myLoad = ++loadId;
    set({ refreshing: true });
    try {
      const list = await api.consoles(force);
      if (myLoad !== loadId) return;
      const consoles: GameConsole[] = list.map((c) => ({
        id: c.id,
        name: c.name.trim(),
        info: isRecompsName(c.name) ? RECOMPS_INFO : consoleInfo(c.name),
        ptbr: isPtBr(c.name),
        games: null,
      }));
      const recompsId = consoles.find((c) => isRecompsName(c.name))?.id ?? null;
      setRecompsId(recompsId);
      set({ consoles, recompsId, shelf: consoles.filter((c) => c.id !== recompsId), byId: Object.fromEntries(consoles.map((c) => [c.id, c])), all: [], byKey: {}, status: 'ready', error: null });

      loadCoverIndexes(
        consoles.map((c) => c.info.sys).filter((s): s is string => !!s),
        () => {
          clearTimeout(coverTimer);
          coverTimer = setTimeout(() => set((s) => ({ coverTick: s.coverTick + 1 })), 250);
        },
      );

      // Cada console chega no seu tempo; juntamos as chegadas num redesenho só (a cada ~0,4 s).
      const arrived = new Map<string, Game[]>();
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      const flush = () => {
        flushTimer = undefined;
        if (myLoad !== loadId || !arrived.size) return;
        const next = get().consoles.map((c) => (arrived.has(c.id) ? { ...c, games: arrived.get(c.id)! } : c));
        arrived.clear();
        const all = next.flatMap((c) => c.games || []);
        set({
          consoles: next,
          shelf: next.filter((c) => c.id !== get().recompsId),
          byId: Object.fromEntries(next.map((c) => [c.id, c])),
          all,
          byKey: Object.fromEntries(all.map((g) => [g.key, g])),
        });
      };
      await Promise.all(
        consoles.map(async (c) => {
          let files: ApiFile[] = [];
          try {
            files = await api.games(c.id);
          } catch (err) {
            console.error(c.name, err);
          }
          arrived.set(c.id, toGames(c, files));
          if (!flushTimer) flushTimer = setTimeout(flush, 400);
        }),
      );
      clearTimeout(flushTimer);
      flush();
      if (force && myLoad === loadId) useUi.getState().toast('Lista recarregada do Drive');
    } catch (err) {
      if (myLoad === loadId) set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    } finally {
      if (myLoad === loadId) set({ refreshing: false });
    }
  },
}));

/** true se algum console ainda não chegou */
export const useStillLoading = () => useLibrary((s) => s.status === 'loading' || s.consoles.some((c) => !c.games));
