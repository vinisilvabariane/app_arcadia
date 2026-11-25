import { ChevronLeft, Dices } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GameGrid } from '../components/GameGrid';
import { Poster, THUMB_IMG_W } from '../components/Poster';
import { GameRail } from '../components/Rail';
import { Tile, tileGrid } from '../components/Tile';
import { btnPlay, btnSoft, EmptyBox, PageHero, SectionHead, SortTabs } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { FRANCHISES } from '../data/franchises';
import { hasCover } from '../lib/covers';
import { fmtNum, hash, plural, rnd } from '../lib/format';
import { consolePath, consolesOf, franchiseGames, pickCovers, sortList } from '../lib/games';
import { useTint } from '../lib/useTint';
import { useLibrary, useStillLoading } from '../store/library';
import { useUi } from '../store/ui';

/** Lista de franquias que têm pelo menos um jogo no acervo. */
export function Franchises() {
  useTint(HOME_TINT);
  const all = useLibrary((s) => s.all);
  const byId = useLibrary((s) => s.byId);
  useLibrary((s) => s.coverTick);
  const loading = useStillLoading();

  const list = useMemo(
    () =>
      FRANCHISES.map((f) => ({ f, games: franchiseGames(all, f) }))
        .filter((x) => x.games.length)
        .sort((a, b) => b.games.length - a.games.length),
    [all],
  );
  const total = list.reduce((s, x) => s + x.games.length, 0);

  return (
    <>
      <PageHero eyebrow="Por série, em qualquer console" title="Franquias">
        {list.length ? (
          <>
            <b>{list.length}</b> franquias · <b>{fmtNum(total)}</b> jogos{loading && ' até agora'}
          </>
        ) : loading ? (
          'Lendo suas pastas no Drive…'
        ) : (
          'Nenhum jogo de franquia famosa encontrado ainda.'
        )}
      </PageHero>
      <section className={'gutter mt-6 ' + tileGrid}>
        {list.map(({ f, games }) => {
          const shorts = [...new Set(consolesOf(games, byId).map((c) => c.info.short))];
          return (
            <Tile
              key={f.id}
              to={'/franquia/' + f.id}
              color={f.color}
              covers={pickCovers(games, 3)}
              title={f.name}
              count={plural(games.length, 'jogo', 'jogos')}
              footer={
                <div className="mt-2 flex flex-wrap gap-1">
                  {shorts.slice(0, 5).map((s) => (
                    <span key={s} className="rounded bg-black/35 px-1.5 py-0.5 font-mono text-[10px] text-white/85">
                      {s}
                    </span>
                  ))}
                  {shorts.length > 5 && <span className="rounded bg-black/35 px-1.5 py-0.5 font-mono text-[10px] text-white/85">+{shorts.length - 5}</span>}
                </div>
              }
            />
          );
        })}
      </section>
    </>
  );
}

/** Página de uma franquia: mosaico de capas, fileiras por console e a grade completa. */
export function FranchisePage() {
  const { id } = useParams();
  const f = FRANCHISES.find((x) => x.id === id);
  const all = useLibrary((s) => s.all);
  const byId = useLibrary((s) => s.byId);
  const seed = useLibrary((s) => s.seed);
  const coverTick = useLibrary((s) => s.coverTick);
  const sort = useUi((s) => s.sort);
  const openGame = useUi((s) => s.openGame);
  const loading = useStillLoading();
  useTint(f ? f.color : HOME_TINT);

  const games = useMemo(() => (f ? franchiseGames(all, f) : []), [all, f]);
  const cs = useMemo(() => consolesOf(games, byId), [games, byId]);
  const sorted = useMemo(() => sortList(games, sort), [games, sort]);
  // mosaico de fundo: repete as capas até encher, sem vizinhos iguais
  const mosaic = useMemo(() => {
    let pics = games.filter(hasCover);
    if (pics.length < 3) pics = games.slice();
    pics.sort((a, b) => hash(a.key + seed) - hash(b.key + seed));
    return pics.length ? Array.from({ length: 30 }, (_, i) => pics[(i * 5 + Math.floor(i / 6) * 3) % pics.length]) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, seed, coverTick]);

  if (!f) {
    return (
      <div className="gutter py-10">
        <EmptyBox>
          Franquia não encontrada. <Link to="/franquias" className="font-bold text-fg underline">Ver todas</Link>
        </EmptyBox>
      </div>
    );
  }

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute -inset-x-10 -top-10 grid rotate-[-6deg] grid-cols-6 gap-2 opacity-25 sm:grid-cols-10">
          {mosaic.map((g, i) => (
            <Poster key={i} game={g} w={THUMB_IMG_W} />
          ))}
        </div>
        <div aria-hidden className="absolute inset-0 bg-linear-to-b from-ink/50 via-ink/85 to-ink" />
        <div className="gutter relative animate-rise py-12 sm:py-20">
          <nav aria-label="Caminho" className="flex items-center gap-2 text-sm text-muted">
            <Link to="/franquias" className="hover:text-fg">
              Franquias
            </Link>
            <span>/</span>
            <b className="text-fg">{f.name}</b>
          </nav>
          <h1 className="display mt-3 text-[clamp(48px,9vw,120px)]">{f.name}</h1>
          <p className="mt-3 text-muted">
            {games.length ? `${plural(games.length, 'jogo', 'jogos')} em ${plural(cs.length, 'console', 'consoles')}` : loading ? 'Carregando seus jogos…' : 'Nenhum jogo dessa franquia no seu Drive ainda.'}
          </p>
          {games.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <button className={btnPlay} onClick={() => openGame(games[rnd(games.length)].key)}>
                <Dices size={18} strokeWidth={2.2} />
                Sortear um
              </button>
              <Link className={btnSoft} to="/franquias">
                <ChevronLeft size={18} strokeWidth={2.6} />
                Todas as franquias
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* fileiras por console só quando tem bastante jogo; senão a grade sozinha fica melhor */}
      {cs.length > 1 &&
        games.length >= 12 &&
        cs.map((c) => {
          const mine = games.filter((g) => g.consoleId === c.id);
          return <GameRail key={c.id} title={c.name} games={mine} count={mine.length} more={consolePath(c.id)} moreLabel="Ver console" />;
        })}

      {games.length > 0 && (
        <section className="gutter mt-10">
          <SectionHead title="Todos os jogos" note={plural(games.length, 'jogo', 'jogos')}>
            <SortTabs />
          </SectionHead>
          <GameGrid games={sorted} resetKey={f.id + sort} />
        </section>
      )}
    </>
  );
}
