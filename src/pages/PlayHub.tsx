import { ArrowLeft, Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GameGrid } from '../components/GameGrid';
import { GameRail } from '../components/Rail';
import { Tile, tileGrid, TileSkeletons } from '../components/Tile';
import { Chip, ChipStrip, EmptyBox, PageHero, PtFlag, SectionHead, SortTabs, btnSoft } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { PLAY_CORES } from '../data/play';
import { fmtNum, plural } from '../lib/format';
import { isExtra, pickCovers, sortList } from '../lib/games';
import { PLAY_ENABLED } from '../lib/play';
import { listRoms } from '../lib/playdb';
import { useTint } from '../lib/useTint';
import { useLibrary, useStillLoading } from '../store/library';
import { useUi } from '../store/ui';
import type { Game, GameConsole } from '../types';

/** o que dá pra jogar de um console: arquivos de jogo (sem pastas, DLC nem update) */
const playable = (c: GameConsole): Game[] => (c.games || []).filter((g) => !g.folder && !isExtra(g));

const Experimental = () => <span className="rounded bg-black/35 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">Experimental</span>;

/* Página "Jogar": os consoles que rodam no navegador. Escolha um e clique num jogo pra abrir
   direto no emulador. ?c=<id do console> guarda qual está aberto. */
export function PlayHub() {
  const [params, setParams] = useSearchParams();
  const shelf = useLibrary((s) => s.shelf);
  const byKey = useLibrary((s) => s.byKey);
  const coverTick = useLibrary((s) => s.coverTick);
  const sort = useUi((s) => s.sort);
  const loading = useStillLoading();

  // só os consoles que têm núcleo no emulador
  const consoles = useMemo(() => shelf.filter((c) => PLAY_CORES[c.info.short]), [shelf]);
  const games = useMemo(() => new Map(consoles.map((c) => [c.id, playable(c)])), [consoles]);
  const current = consoles.find((c) => c.id === params.get('c'));
  useTint(current ? current.info.color : HOME_TINT);

  // capas do leque de cada console
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fans = useMemo(() => new Map(consoles.map((c) => [c.id, pickCovers(games.get(c.id) || [], 3)])), [consoles, games, coverTick]);

  // "Continuar jogando": o que está no cache de ROMs, do mais recente pro mais antigo
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    if (PLAY_ENABLED)
      listRoms()
        .then((roms) => setRecentIds(roms.map((r) => r.id)))
        .catch(() => {});
  }, []);
  const recent = useMemo(() => recentIds.map((id) => byKey[id]).filter((g): g is Game => !!g && !!PLAY_CORES[g.short]), [recentIds, byKey]);

  const list = useMemo(() => (current ? sortList(games.get(current.id) || [], sort) : []), [current, games, sort]);
  const total = consoles.reduce((n, c) => n + (games.get(c.id)?.length || 0), 0);
  const open = (id?: string) => setParams(id ? { c: id } : {});

  if (!PLAY_ENABLED) {
    return (
      <>
        <PageHero eyebrow="No navegador" title="Jogar" />
        <section className="gutter mt-6">
          <EmptyBox>O “Jogar no navegador” está desligado: falta a chave de API do Drive, ou este navegador não tem o que o emulador precisa.</EmptyBox>
        </section>
      </>
    );
  }

  /* ---------- um console aberto: os jogos dele ---------- */
  if (current) {
    const core = PLAY_CORES[current.info.short];
    return (
      <>
        <section className="gutter animate-rise pt-8">
          <button onClick={() => open()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg">
            <ArrowLeft size={16} strokeWidth={2.4} />
            Todos os consoles
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="display text-[clamp(34px,6vw,64px)]">{current.name.trim()}</h1>
            {core.experimental && <span className="rounded bg-amber-400/15 px-2 py-1 text-[11px] font-bold tracking-wide text-amber-200 uppercase">Experimental</span>}
          </div>
          <p className="mt-2 text-sm text-muted">
            {current.games ? plural(list.length, 'jogo roda no navegador', 'jogos rodam no navegador') : 'Carregando os jogos…'} · clique na capa pra jogar
            {core.experimental && ' · pode ficar pesado em celular ou PC fraco'}
          </p>
        </section>

        <ChipStrip label="Trocar de console" centerOn={current.id}>
          {consoles.map((c) => (
            <Chip key={c.id} on={c.id === current.id} color={c.info.color} count={c.games ? fmtNum(games.get(c.id)?.length || 0) : null} onClick={() => open(c.id)}>
              {c.name.trim()}
            </Chip>
          ))}
        </ChipStrip>

        <section className="gutter mt-3">
          <div className="mb-5">
            <SortTabs />
          </div>
          {list.length ? <GameGrid games={list} play resetKey={current.id + sort} /> : <EmptyBox>{current.games ? 'Nenhum jogo desse console roda aqui.' : 'Carregando…'}</EmptyBox>}
        </section>
      </>
    );
  }

  /* ---------- visão geral: escolher o console ---------- */
  return (
    <>
      <PageHero eyebrow="No navegador" title="Jogar">
        {consoles.length ? (
          <>
            <b>{consoles.length}</b> consoles rodam aqui, sem instalar nada · <b>{fmtNum(total)}</b> jogos{loading && ' até agora'}. A ROM vem do Drive e fica guardada no navegador.
          </>
        ) : loading ? (
          'Lendo suas pastas no Drive…'
        ) : (
          'Nenhum console do acervo roda no navegador ainda.'
        )}
      </PageHero>

      <GameRail title="Continuar jogando" games={recent} count={recent.length} play className="mt-6" />

      <section className="gutter mt-8">
        <SectionHead title="Escolha o console" note={consoles.length ? plural(consoles.length, 'console', 'consoles') : undefined}>
          <Link to="/cache" className={btnSoft + ' h-9! px-3 text-[13px]'}>
            <Settings size={15} strokeWidth={2.3} />
            Cache e saves
          </Link>
        </SectionHead>
        <div className={tileGrid}>
          {consoles.length ? (
            consoles.map((c) => (
              <Tile
                key={c.id}
                to={'/jogar?c=' + encodeURIComponent(c.id)}
                color={c.info.color}
                covers={fans.get(c.id)}
                title={c.info.short}
                subtitle={c.name.replace(/\([^)]*\)/g, '').trim()}
                count={c.games ? plural(games.get(c.id)?.length || 0, 'jogo', 'jogos') : 'carregando…'}
                corner={PLAY_CORES[c.info.short].experimental ? <Experimental /> : c.ptbr ? <PtFlag /> : undefined}
              />
            ))
          ) : loading ? (
            <TileSkeletons />
          ) : null}
        </div>
      </section>
    </>
  );
}
