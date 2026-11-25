import { create } from 'zustand';
import { consoleInfo, isPtBr } from '../data/consoles';
import { api } from '../lib/api';
import { initCovers, warmCovers } from '../lib/covers';
import { parseName } from '../lib/format';
import { isRecompsName, setRecompsId } from '../lib/games';
import { idb } from '../lib/idb';
import type { ApiConsole, ApiFile, Game, GameConsole } from '../types';
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
  /** true enquanto confere o Drive (primeira carga ou atualização em segundo plano) */
  refreshing: boolean;
  /** muda quando uma lista de capas termina de carregar (as telas redesenham) */
  coverTick: number;
  /** semente da sessão: embaralha destaques de um jeito estável */
  seed: number;
  load: (force?: boolean) => Promise<void>;
}

/* Cópia do acervo guardada no navegador (IndexedDB).
   Com ela o site abre na hora mostrando a última lista conhecida, e o Drive é conferido
   em segundo plano. Sem ela, cada visita esperava ~36 chamadas ao Apps Script e
   redesenhava a tela inteira a cada console que chegava. */
const SNAPSHOT_KEY = 'acervo-v1';
/** Por quanto tempo a cópia vale sem conferir o Drive de novo. */
const FRESH_MS = 12 * 60 * 60 * 1000;
interface Snapshot {
  t: number;
  consoles: { id: string; name: string; files: ApiFile[] }[];
}

const RECOMPS_INFO = { short: 'PC', color: '#7c5cff', sys: null };

function toConsole(c: ApiConsole): GameConsole {
  return {
    id: c.id,
    name: c.name.trim(),
    info: isRecompsName(c.name) ? RECOMPS_INFO : consoleInfo(c.name),
    ptbr: isPtBr(c.name),
    games: null,
  };
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
      pt: c.ptbr || isPtBr(p.base),
    };
  });
}

/** Tudo que se calcula a partir da lista de consoles (índices, lista geral, RECOMPS). */
function derive(consoles: GameConsole[]) {
  const recompsId = consoles.find((c) => isRecompsName(c.name))?.id ?? null;
  setRecompsId(recompsId);
  const all = consoles.flatMap((c) => c.games || []);
  return {
    consoles,
    recompsId,
    shelf: consoles.filter((c) => c.id !== recompsId),
    byId: Object.fromEntries(consoles.map((c) => [c.id, c])),
    all,
    byKey: Object.fromEntries(all.map((g) => [g.key, g])),
  };
}

function fromSnapshot(snap: Snapshot): GameConsole[] {
  return snap.consoles.map((s) => {
    const c = toConsole(s);
    c.games = toGames(c, s.files);
    return c;
  });
}

let loadId = 0;
let coverTimer: ReturnType<typeof setTimeout>;

export const useLibrary = create<LibraryState>((set, get) => {
  // Uma lista de capas chegou: redesenha as telas (juntando as chegadas próximas numa só).
  initCovers(() => {
    clearTimeout(coverTimer);
    coverTimer = setTimeout(() => set((s) => ({ coverTick: s.coverTick + 1 })), 250);
  });
  /** Resolve em segundo plano as capas que ainda faltam (na primeira visita: todas). */
  const startCovers = (consoles: GameConsole[]) => warmCovers(consoles.flatMap((c) => c.games || []));

  return {
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
      const current = () => myLoad === loadId;
      set({ refreshing: true });

      // 1. Abre na hora com a cópia guardada (se tiver).
      const snap = await idb.get<Snapshot>(SNAPSHOT_KEY);
      if (!current()) return;
      const hadSnapshot = !!snap?.consoles?.length;
      if (hadSnapshot && get().status !== 'ready') {
        const consoles = fromSnapshot(snap!);
        set({ ...derive(consoles), status: 'ready', error: null });
        startCovers(consoles);
      }

      // 2. Cópia recente: fica com ela e não incomoda o Drive. O botão de recarregar força a conferência.
      if (hadSnapshot && !force && Date.now() - snap!.t < FRESH_MS) {
        set({ refreshing: false });
        return;
      }

      // 3. Confere o Drive.
      try {
        const list = await api.consoles(force);
        if (!current()) return;
        const fresh = list.map(toConsole);
        const files = new Map<string, ApiFile[]>();
        const failed = new Set<string>();

        if (!hadSnapshot) {
          // Primeira visita: mostra os consoles conforme chegam (juntando as chegadas a cada ~0,4 s).
          set({ ...derive(fresh), status: 'ready', error: null });
        }
        let flushTimer: ReturnType<typeof setTimeout> | undefined;
        const flush = () => {
          flushTimer = undefined;
          if (!current()) return;
          set(derive(get().consoles.map((c) => (c.games || !files.has(c.id) ? c : { ...c, games: toGames(c, files.get(c.id)!) }))));
        };

        await Promise.all(
          fresh.map(async (c) => {
            try {
              files.set(c.id, await api.games(c.id));
            } catch (err) {
              console.error(c.name, err);
              failed.add(c.id);
              // falhou agora: mantém o que já se sabia desse console em vez de esvaziar
              files.set(c.id, snap?.consoles.find((s) => s.id === c.id)?.files || []);
            }
            if (!hadSnapshot && !flushTimer) flushTimer = setTimeout(flush, 400);
          }),
        );
        clearTimeout(flushTimer);
        if (!current()) return;

        const next: Snapshot = { t: Date.now(), consoles: list.map((c) => ({ id: c.id, name: c.name, files: files.get(c.id) || [] })) };
        if (!hadSnapshot) {
          flush();
          startCovers(get().consoles);
        } else if (JSON.stringify(next.consoles) !== JSON.stringify(snap!.consoles)) {
          // Já estava na tela pela cópia: só redesenha (uma vez) se algo mudou no Drive.
          const consoles = fromSnapshot(next);
          set(derive(consoles));
          startCovers(consoles);
          if (!force) useUi.getState().toast('Acervo atualizado');
        }
        idb.set(SNAPSHOT_KEY, next);
        if (force) useUi.getState().toast(failed.size ? `Recarregado, mas ${failed.size} console(s) não responderam` : 'Lista recarregada do Drive');
      } catch (err) {
        if (!current()) return;
        if (hadSnapshot) useUi.getState().toast('Sem resposta do Drive: mostrando a última lista salva');
        else set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      } finally {
        if (current()) set({ refreshing: false });
      }
    },
  };
});

/** true se algum console ainda não chegou */
export const useStillLoading = () => useLibrary((s) => s.status === 'loading' || s.consoles.some((c) => !c.games));
