import { Download, Info } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FavButton } from '../components/FavButton';
import { Poster, useBlurBg } from '../components/Poster';
import { GameRail, LazyMount, Rail } from '../components/Rail';
import { btnPlay, btnSoft, cvar, Tag } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { hasCover } from '../lib/covers';
import { fmtNum, fmtSize, hash } from '../lib/format';
import { byNewest, consolePath, downloadUrl, pickCovers, rowOrder } from '../lib/games';
import { useTint } from '../lib/useTint';
import { useFavs } from '../store/favorites';
import { useLibrary } from '../store/library';
import { useUi } from '../store/ui';
import type { Game, GameConsole } from '../types';

/** Destaque do topo: um jogo com capa de cada console, trocando sozinho a cada 9 s. */
function Hero({ picks }: { picks: Game[] }) {
  const [idx, setIdx] = useState(0);
  const hover = useRef(false);
  const openGame = useUi((s) => s.openGame);
  const g: Game | undefined = picks[idx % Math.max(1, picks.length)];
  const bg = useBlurBg(g);
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

  if (!g) {
    return (
      <section className="gutter flex min-h-[46vh] items-center">
        <div>
          <div className="text-xs font-bold tracking-[.14em] text-muted uppercase">Sua coleção</div>
          <h1 className="display mt-3 animate-pulse text-[clamp(36px,6vw,72px)]">Lendo suas pastas no Drive…</h1>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden" onMouseEnter={() => (hover.current = true)} onMouseLeave={() => (hover.current = false)}>
      <div key={g.key + 'bg'} aria-hidden className="absolute inset-0 scale-125 animate-fade bg-cover bg-center opacity-40 blur-3xl" style={bg ? { backgroundImage: `url('${bg}')` } : { background: g.color }} />
      <div aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent via-ink/40 to-ink" />
      <div key={g.key} className="gutter relative flex min-h-[52vh] animate-rise items-center gap-4 py-10 sm:gap-10 sm:py-14">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 text-xs font-bold tracking-[.12em] text-fg/80 uppercase">
            <span style={cvar(g.color)} className="rounded-md bg-(--c) px-2 py-1 font-display text-[11px] text-white">
              {g.short}
            </span>
            Em destaque no {g.consoleName}
          </div>
          <h1 className="display mt-4 line-clamp-3 max-w-[16ch] text-[clamp(40px,7vw,92px)]">{g.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {g.tags.map((t, i) => (
              <Tag key={i}>{t}</Tag>
            ))}
            {g.size > 0 && <span className="ml-1 font-mono text-xs text-muted">{fmtSize(g.size)}</span>}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <a className={btnPlay} href={downloadUrl(g)} target="_blank" rel="noopener">
              <Download size={18} strokeWidth={2.6} />
              Baixar
            </a>
            <button className={btnSoft} onClick={() => openGame(g.key)}>
              <Info size={18} strokeWidth={2.4} />
              Detalhes
            </button>
            <FavButton game={g} variant="button" />
          </div>
        </div>
        <button onClick={() => openGame(g.key)} aria-label={`Detalhes de ${g.title}`} className="w-24 shrink-0 rotate-2 self-start transition duration-300 hover:scale-[1.03] hover:rotate-0 sm:w-40 sm:self-center md:w-[min(26vw,290px)]">
          <Poster game={g} w={560} className="rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/15" />
        </button>
      </div>
      {picks.length > 1 && (
        <div role="tablist" aria-label="Destaques" className="gutter relative flex gap-1.5 pb-2">
          {picks.map((p, i) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={i === idx}
              aria-label={p.title}
              onClick={() => setIdx(i)}
              className={'h-1.5 rounded-full transition-all duration-300 ' + (i === idx ? 'w-8 bg-fg' : 'w-4 bg-white/25 hover:bg-white/50')}
            />
          ))}
        </div>
      )}
    </section>
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

      {consoles.length > 0 && (
        <Rail title="Consoles" count={consoles.length} more="/consoles" moreLabel="Ver todos">
          {consoles.map((c) => (
            <Link
              key={c.id}
              to={consolePath(c.id)}
              style={cvar(c.info.color, { background: 'linear-gradient(150deg, var(--c), color-mix(in srgb, var(--c) 40%, #0b0c12))' })}
              className="relative flex h-24 w-44 shrink-0 snap-start flex-col justify-end rounded-xl p-3 ring-1 ring-white/10 transition hover:-translate-y-1 hover:ring-white/40"
            >
              <span className="absolute top-2.5 right-3 font-mono text-[11px] text-white/75">{c.games ? fmtNum(c.games.length) : '…'}</span>
              <span className="display text-2xl text-white">{c.info.short}</span>
              <span className="truncate text-[11px] font-semibold text-white/80">{c.name}</span>
            </Link>
          ))}
        </Rail>
      )}

      <GameRail title="Minha lista" games={favList.slice(0, 30)} count={favList.length} more="/minha-lista" />
      <GameRail title="Adicionados recentemente" games={recent} />
      <GameRail title="Em português" games={pt.row} count={pt.total} />
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
