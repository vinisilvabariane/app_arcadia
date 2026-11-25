import { Download, Info } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FavButton } from '../components/FavButton';
import { GameCard } from '../components/GameCard';
import { Poster, THUMB_IMG_W } from '../components/Poster';
import { GameRail, LazyMount, Rail } from '../components/Rail';
import { cvar, PtFlag } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { FRANCHISES } from '../data/franchises';
import { coverUrls, hasCover } from '../lib/covers';
import { fmtNum, fmtSize, hash, plural } from '../lib/format';
import { byNewest, consolePath, downloadUrl, franchiseGames, isExtra, pickCovers, rowOrder } from '../lib/games';
import { getSynopsis } from '../lib/synopsis';
import { useTint } from '../lib/useTint';
import { useFavs } from '../store/favorites';
import { useLibrary, useStillLoading } from '../store/library';
import { useUi } from '../store/ui';
import type { Game, GameConsole } from '../types';

/* Página inicial no estilo dos streamings: um destaque grande no topo e fileiras embaixo. */

/** Resumo do jogo em destaque (Wikipédia, com cache). Vazio enquanto busca ou se não achar. */
function useSynopsisText(g: Game | undefined): string {
  const [text, setText] = useState('');
  useEffect(() => {
    let alive = true;
    setText('');
    if (g) getSynopsis(g).then((d) => alive && setText(d?.text || ''), () => {});
    return () => {
      alive = false;
    };
  }, [g]);
  return text;
}

/** Destaque do topo: ocupa a tela, com a capa ampliada de fundo, e troca sozinho a cada 9 s. */
function Hero({ picks }: { picks: Game[] }) {
  const [idx, setIdx] = useState(0);
  const hover = useRef(false);
  const openGame = useUi((s) => s.openGame);
  useLibrary((s) => s.coverTick);
  const g: Game | undefined = picks[idx % Math.max(1, picks.length)];
  const art = g ? coverUrls(g, 640)[0] : undefined;
  const synopsis = useSynopsisText(g);
  useTint(g ? g.color : HOME_TINT);

  useEffect(() => {
    if (picks.length < 2) return;
    const t = setInterval(() => {
      // pausa com o mouse em cima, com o modal aberto ou com a aba escondida
      if (hover.current || document.hidden || useUi.getState().modalKey) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setIdx((i) => (i + 1) % picks.length);
    }, 9000);
    return () => clearInterval(t);
  }, [picks.length]);

  // -mt: o destaque sobe por baixo da barra do topo, que fica transparente em cima dele
  const frame = 'relative -mt-[68px] overflow-hidden';
  if (!g) {
    return (
      <section className={frame}>
        <div className="gutter flex min-h-[70vh] items-end pt-[110px] pb-28">
          <div className="w-full max-w-xl animate-pulse space-y-4">
            <div className="h-4 w-40 rounded bg-ink-3" />
            <div className="h-16 w-full rounded bg-ink-3" />
            <div className="h-16 w-2/3 rounded bg-ink-3" />
            <div className="h-12 w-72 rounded bg-ink-3" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={frame} onMouseEnter={() => (hover.current = true)} onMouseLeave={() => (hover.current = false)}>
      {/* fundo: a própria capa, ampliada e escurecida (fica suave por estar esticada) */}
      <div key={g.key + 'bg'} aria-hidden className="absolute inset-0 animate-fade" style={{ background: `color-mix(in srgb, ${g.color} 45%, #0b0c12)` }}>
        {art && <img src={art} alt="" className="size-full object-cover object-[50%_22%] opacity-55" />}
      </div>
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,#0b0c12_0%,rgb(11_12_18/.86)_32%,rgb(11_12_18/.25)_72%,rgb(11_12_18/.5)_100%)]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-ink/80 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-ink via-ink/60 to-transparent" />

      <div className="gutter relative flex min-h-[min(82vh,780px)] items-end gap-10 pt-[110px] pb-28">
        <div key={g.key} className="min-w-0 flex-1 animate-rise">
          <div className="flex items-center gap-2.5 text-[11px] font-bold tracking-[.2em] text-fg/75 uppercase">
            <span style={cvar(g.color)} className="rounded bg-(--c) px-2 py-1 font-display text-xs tracking-normal text-white">
              {g.short}
            </span>
            Em destaque
          </div>
          <h1 className="display mt-4 line-clamp-3 max-w-[14ch] text-[clamp(40px,6.6vw,92px)] [text-shadow:0_2px_24px_rgb(0_0_0/.5)]">{g.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold text-fg/85">
            {g.pt && <PtFlag />}
            <span>{g.consoleName}</span>
            {g.ext && <span className="rounded border border-white/35 px-1.5 text-[11px] leading-5 uppercase">{g.ext}</span>}
            {g.size > 0 && <span className="font-mono text-xs font-normal text-fg/70">{fmtSize(g.size)}</span>}
            {g.tags.slice(0, 2).map((t, i) => (
              <span key={i} className="text-fg/60">
                {t}
              </span>
            ))}
          </div>
          {synopsis && <p className="mt-4 line-clamp-3 max-w-xl animate-fade text-[15px] leading-relaxed text-fg/80">{synopsis}</p>}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a href={downloadUrl(g)} target="_blank" rel="noopener" className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-fg px-7 text-base font-bold text-ink transition hover:bg-white active:scale-[.97]">
              <Download size={20} strokeWidth={2.8} />
              Baixar
            </a>
            <button onClick={() => openGame(g.key)} className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white/20 px-6 text-base font-bold text-fg transition hover:bg-white/30 active:scale-[.97]">
              <Info size={20} strokeWidth={2.4} />
              Mais informações
            </button>
            <div className="[&>button]:h-12">
              <FavButton game={g} variant="button" />
            </div>
          </div>

          {/* os outros destaques: clique pra trocar */}
          {picks.length > 1 && (
            <div role="tablist" aria-label="Destaques" className="mt-8 flex items-end gap-2">
              {picks.map((p, i) => (
                <button
                  key={p.key}
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={p.title}
                  title={p.title}
                  onClick={() => setIdx(i)}
                  className={'shrink-0 rounded-md transition-all duration-300 ' + (i === idx ? 'w-14 ring-2 ring-white' : 'w-10 opacity-45 hover:opacity-100')}
                >
                  <Poster game={p} w={THUMB_IMG_W} className="rounded-md" />
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          key={g.key + 'cover'}
          onClick={() => openGame(g.key)}
          aria-label={`Detalhes de ${g.title}`}
          className="hidden w-[min(22vw,270px)] shrink-0 animate-rise transition-transform duration-300 hover:scale-[1.03] lg:block"
        >
          <Poster game={g} w={540} className="rounded-xl shadow-2xl shadow-black/80 ring-1 ring-white/20" />
        </button>
      </div>
    </section>
  );
}

/** Fileira "Top 10" com os números gigantes atrás das capas. */
function TopTen({ games }: { games: Game[] }) {
  if (games.length < 5) return null;
  return (
    <Rail title="Top 10 recém-chegados" className="relative z-10 -mt-16">
      {games.map((g, i) => (
        <div key={g.key} className="flex shrink-0 snap-start items-end">
          <span aria-hidden className="display -mr-2 text-[120px] leading-[.78] text-ink select-none [-webkit-text-stroke:3px_#6b7189] sm:-mr-5 sm:text-[190px]">
            {i + 1}
          </span>
          <GameCard game={g} bare className="relative w-[112px] sm:w-[150px]" />
        </div>
      ))}
    </Rail>
  );
}

/** Fileira de coleções (franquias). Só calcula depois que o acervo todo chegou: são ~40 buscas na lista inteira. */
function Collections() {
  const all = useLibrary((s) => s.all);
  const loading = useStillLoading();
  const coverTick = useLibrary((s) => s.coverTick);
  const list = useMemo(
    () =>
      loading
        ? []
        : FRANCHISES.map((f) => ({ f, games: franchiseGames(all, f) }))
            .filter((x) => x.games.length >= 3)
            .sort((a, b) => b.games.length - a.games.length)
            .slice(0, 14)
            .map((x) => ({ ...x, cover: pickCovers(x.games, 1)[0] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, loading, coverTick],
  );
  if (!list.length) return null;
  return (
    <Rail title="Coleções" count={list.length} more="/franquias" moreLabel="Ver todas">
      {list.map(({ f, games, cover }) => (
        <Link
          key={f.id}
          to={'/franquia/' + f.id}
          style={cvar(f.color, { background: 'linear-gradient(120deg, var(--c), color-mix(in srgb, var(--c) 30%, #0b0c12))' })}
          className="relative flex h-32 w-64 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-xl p-4 ring-1 ring-white/10 transition-transform duration-200 hover:scale-[1.03] hover:ring-white/60"
        >
          {cover && (
            <div aria-hidden className="absolute top-3 -right-3 w-[92px] rotate-6">
              <Poster game={cover} w={THUMB_IMG_W} />
            </div>
          )}
          <div aria-hidden className="absolute inset-0 bg-linear-to-r from-black/45 to-transparent" />
          <span className="display relative max-w-[62%] text-[22px] leading-none text-white">{f.name}</span>
          <span className="relative mt-1 font-mono text-[11px] text-white/75">{plural(games.length, 'jogo', 'jogos')}</span>
        </Link>
      ))}
    </Rail>
  );
}

/** Fileira de um console. Separada (e com memo) pra só redesenhar quando aquele console muda. */
const ConsoleRow = memo(function ConsoleRow({ console: c }: { console: GameConsole }) {
  const coverTick = useLibrary((s) => s.coverTick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const row = useMemo(() => (c.games ? rowOrder(c.games).slice(0, 18) : null), [c.games, coverTick]);
  return <GameRail title={c.name} games={row} count={c.games?.length} more={c.games ? consolePath(c.id) : undefined} />;
});

export function Home() {
  const consoles = useLibrary((s) => s.shelf);
  const all = useLibrary((s) => s.all);
  const byKey = useLibrary((s) => s.byKey);
  const seed = useLibrary((s) => s.seed);
  const coverTick = useLibrary((s) => s.coverTick);
  const favs = useFavs((s) => s.favs);

  // Destaques: um jogo com capa de cada console, em ordem embaralhada por sessão.
  // Depois de achar 6, congela (senão o destaque pula a cada console que chega).
  const frozen = useRef<Game[] | null>(null);
  const picks = useMemo(() => {
    if (!all.length) frozen.current = null;
    if (frozen.current) return frozen.current;
    const out: Game[] = [];
    consoles
      .filter((c) => c.games?.length)
      .sort((a, b) => hash(a.id + seed) - hash(b.id + seed))
      .forEach((c) => {
        if (out.length >= 6) return;
        const p = pickCovers(c.games!, 1, seed)[0];
        if (p && hasCover(p)) out.push(p);
      });
    if (!out.length && all.length) out.push(all[seed % all.length]);
    if (out.length >= 6) frozen.current = out;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoles, all, seed, coverTick]);

  // Top 10: os que chegaram por último, entre os que têm capa (é a vitrine da página).
  // Olha só os 80 mais recentes pra não procurar capa no acervo inteiro.
  const top10 = useMemo(() => {
    const newest = byNewest(all.filter((g) => !g.folder && !isExtra(g)), 80);
    const withCover = newest.filter(hasCover);
    return (withCover.length >= 10 ? withCover : newest).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, coverTick]);
  const recent = useMemo(() => byNewest(all, 20), [all]);
  const pt = useMemo(() => {
    const list = all.filter((g) => g.pt);
    return { total: list.length, row: rowOrder(list).slice(0, 20) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, coverTick]);
  const favList = useMemo(
    () => Object.keys(favs).map((k) => byKey[k]).filter(Boolean).sort((a, b) => favs[b.key] - favs[a.key]),
    [favs, byKey],
  );

  return (
    <>
      <Hero picks={picks} />
      <TopTen games={top10} />

      <GameRail title="Minha lista" games={favList.slice(0, 30)} count={favList.length} more="/minha-lista" />

      {consoles.length > 0 && (
        <Rail title="Navegar por console" count={consoles.length} more="/consoles" moreLabel="Ver todos">
          {consoles.map((c) => (
            <Link
              key={c.id}
              to={consolePath(c.id)}
              style={cvar(c.info.color, { background: 'linear-gradient(150deg, var(--c), color-mix(in srgb, var(--c) 40%, #0b0c12))' })}
              className="relative flex h-24 w-44 shrink-0 snap-start flex-col justify-end rounded-xl p-3 ring-1 ring-white/10 transition-transform duration-200 hover:scale-[1.04] hover:ring-white/60"
            >
              <span className="absolute top-2.5 right-3 font-mono text-[11px] text-white/75">{c.games ? fmtNum(c.games.length) : '…'}</span>
              <span className="display text-2xl text-white">{c.info.short}</span>
              <span className="truncate text-[11px] font-semibold text-white/80">{c.name}</span>
            </Link>
          ))}
        </Rail>
      )}

      <LazyMount height={220}>
        <Collections />
      </LazyMount>
      <LazyMount>
        <GameRail title="Adicionados recentemente" games={recent} />
      </LazyMount>
      <LazyMount>
        <GameRail title="Em português" games={pt.row} count={pt.total} />
      </LazyMount>
      {consoles.map((c) =>
        c.games && !c.games.length ? null : (
          <LazyMount key={c.id}>
            <ConsoleRow console={c} />
          </LazyMount>
        ),
      )}
    </>
  );
}
