import { ChevronDown, Dices, Download, Info } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FavButton } from '../components/FavButton';
import { Poster } from '../components/Poster';
import { GameRail } from '../components/Rail';
import { Synopsis } from '../components/Synopsis';
import { btnPlay, btnSoft, PageHero, PtFlag } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { hasCover } from '../lib/covers';
import { fmtSize, plural, rnd } from '../lib/format';
import { downloadUrl, isExtra } from '../lib/games';
import { useTint } from '../lib/useTint';
import { useFavs } from '../store/favorites';
import { useLibrary, useStillLoading } from '../store/library';
import { useUi } from '../store/ui';
import type { Game } from '../types';
import { EmuHint } from './Console';

/* Sorteio: roleta de capas que desacelera até o jogo escolhido. */
const REEL_LEN = 64;
const REEL_WIN = 56; // posição do sorteado na roleta
const CARD_GAP = 14;

/** enche a roleta preferindo jogos com capa (fica mais bonito girando) */
function reelFill(pool: Game[], n: number): Game[] {
  const pretty: Game[] = [];
  for (let k = 0; k < 150 && pool.length; k++) {
    const cand = pool[rnd(pool.length)];
    if (hasCover(cand)) pretty.push(cand);
  }
  const src = pretty.length >= 8 ? pretty : pool;
  return Array.from({ length: n }, () => src[rnd(src.length)]);
}

function Switch({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <button aria-pressed={on} onClick={() => onChange(!on)} className="inline-flex h-11 items-center gap-2.5 rounded-lg bg-ink-2 px-3.5 text-sm font-semibold ring-1 ring-line transition hover:bg-ink-3">
      <i className={'relative h-5 w-9 rounded-full transition ' + (on ? 'bg-emerald-500' : 'bg-line')}>
        <i className={'absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition ' + (on ? 'translate-x-4' : '')} />
      </i>
      {children}
    </button>
  );
}

/** confete quando a roleta para */
function Burst({ color }: { color: string }) {
  const bits = useMemo(() => {
    const colors = [color, 'var(--tint)', '#ffffff', '#ffd166'];
    return Array.from({ length: 46 }, (_, i) => {
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 300;
      return {
        '--dx': Math.round(Math.cos(a) * d * 1.6) + 'px',
        '--dy': Math.round(Math.sin(a) * d * 0.7) + 'px',
        '--r': rnd(720) + 'deg',
        '--k': colors[i % colors.length],
        animationDelay: rnd(120) + 'ms',
      } as React.CSSProperties;
    });
  }, [color]);
  return (
    <div aria-hidden className="burst pointer-events-none absolute inset-0 z-20">
      {bits.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}

export function Raffle() {
  const all = useLibrary((s) => s.all);
  const consoles = useLibrary((s) => s.consoles);
  const byId = useLibrary((s) => s.byId);
  const coverTick = useLibrary((s) => s.coverTick);
  const favs = useFavs((s) => s.favs);
  const openGame = useUi((s) => s.openGame);
  const loading = useStillLoading();

  const [consoleId, setConsoleId] = useState('');
  const [onlyPt, setOnlyPt] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle');
  const [spinReel, setSpinReel] = useState<Game[]>([]);
  const [spinId, setSpinId] = useState(0);
  const [winner, setWinner] = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>([]);

  const stage = useRef<HTMLDivElement>(null);
  const reel = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);
  const pending = useRef<Game | null>(null);

  const sel = byId[consoleId];
  useTint(winner ? winner.color : sel ? sel.info.color : HOME_TINT);

  // só jogos, sem pasta/DLC/update
  const pool = useMemo(
    () => all.filter((g) => !g.folder && !isExtra(g) && (!consoleId || g.consoleId === consoleId) && (!onlyPt || g.pt) && (!onlyFav || favs[g.key])),
    [all, consoleId, onlyPt, onlyFav, favs],
  );
  // roleta "em espera": capas passando devagar (lista dobrada pra emendar sem salto)
  const idleReel = useMemo(() => {
    const l = pool.length ? reelFill(pool, 18) : [];
    return l.concat(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, coverTick > 0]);

  // mexeu nos filtros: volta pra espera
  const reset = () => {
    if (phase === 'spinning') return false;
    setPhase('idle');
    setWinner(null);
    return true;
  };

  const spin = useCallback(() => {
    if (phase === 'spinning' || !pool.length) return;
    // evita repetir o último sorteado quando dá
    let w = pool[rnd(pool.length)];
    if (pool.length > 1 && winner && w === winner) w = pool[(pool.indexOf(w) + 1 + rnd(pool.length - 1)) % pool.length];
    const list = reelFill(pool, REEL_LEN);
    list[REEL_WIN] = w;
    pending.current = w;
    setSpinReel(list);
    setWinner(null);
    setPhase('spinning');
    setSpinId((n) => n + 1);
  }, [phase, pool, winner]);

  // A animação em si: roda logo depois que a roleta nova entra na tela.
  useLayoutEffect(() => {
    const st = stage.current;
    const el = reel.current;
    const w = pending.current;
    if (!spinId || !st || !el || !w) return;
    const card = el.children[REEL_WIN] as HTMLElement;
    const center = () => Math.round(st.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2));

    el.style.transition = 'none';
    el.style.transform = 'translateX(0px)';
    void el.offsetWidth; // força o navegador a aplicar o ponto de partida

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 5200 + rnd(900);
    const jitter = (Math.random() - 0.5) * card.offsetWidth * 0.55;
    el.style.transition = dur ? `transform ${dur}ms cubic-bezier(.08,.72,.12,1)` : 'none';
    el.style.transform = `translateX(${center() + Math.round(jitter)}px)`;

    // a moldura dá um "tique" a cada capa que passa por ela
    let raf = 0;
    if (dur) {
      const step = card.offsetWidth + CARD_GAP;
      let last: number | null = null;
      const loop = () => {
        const x = new DOMMatrix(getComputedStyle(el).transform).m41;
        const idx = Math.floor((st.clientWidth / 2 - x) / step);
        if (last !== null && idx !== last && frame.current) {
          frame.current.classList.remove('animate-tick');
          void frame.current.offsetWidth;
          frame.current.classList.add('animate-tick');
        }
        last = idx;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const done = setTimeout(() => {
      cancelAnimationFrame(raf);
      // assenta no centro exato do jogo sorteado
      el.style.transition = dur ? 'transform .45s cubic-bezier(.3,1.4,.5,1)' : 'none';
      el.style.transform = `translateX(${center()}px)`;
      setWinner(w);
      setPhase('done');
      setHistory((h) => [w, ...h.filter((x) => x !== w)].slice(0, 13));
      setTimeout(() => {
        const r = result.current;
        if (r && r.getBoundingClientRect().bottom > window.innerHeight) r.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
      }, reduce ? 0 : 700);
    }, dur + 30);

    return () => {
      clearTimeout(done);
      cancelAnimationFrame(raf);
    };
  }, [spinId]);

  // voltou pra espera: solta a posição que a animação deixou
  useLayoutEffect(() => {
    if (phase === 'idle' && reel.current) {
      reel.current.style.transition = '';
      reel.current.style.transform = '';
    }
  }, [phase]);

  // espaço gira a roleta
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || useUi.getState().modalKey) return;
      if (/input|textarea|select|button|a/i.test(document.activeElement?.tagName || '')) return;
      e.preventDefault();
      spin();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [spin]);

  const idle = phase === 'idle';
  const cards = idle ? idleReel : spinReel;
  const winConsole = winner ? byId[winner.consoleId] : undefined;

  return (
    <>
      <PageHero eyebrow="Não sabe o que jogar?" title="Sorteio">
        A roleta escolhe um jogo da sua coleção. Gostou, baixa; não gostou, gira de novo.
      </PageHero>

      <div className="gutter mt-5 flex flex-wrap items-center gap-2.5">
        <label className="relative inline-flex h-11 items-center gap-2 rounded-lg bg-ink-2 pr-9 pl-3.5 text-sm ring-1 ring-line">
          <span className="text-muted">Sortear de</span>
          <select
            value={consoleId}
            onChange={(e) => reset() && setConsoleId(e.target.value)}
            className="max-w-[46vw] appearance-none truncate bg-transparent font-semibold outline-none [&>option]:bg-ink-2"
          >
            <option value="">Todos os consoles</option>
            {consoles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} strokeWidth={2.6} className="pointer-events-none absolute right-3 text-muted" />
        </label>
        <Switch on={onlyPt} onChange={(v) => reset() && setOnlyPt(v)}>
          Em português
        </Switch>
        <Switch on={onlyFav} onChange={(v) => reset() && setOnlyFav(v)}>
          Da minha lista
        </Switch>
        <span className="font-mono text-xs text-muted">{plural(pool.length, 'jogo', 'jogos')} na roleta</span>
      </div>

      {/* palco */}
      <div ref={stage} className="relative mt-6 h-[264px] overflow-hidden border-y border-line bg-ink-2/60 py-6">
        {cards.length ? (
          <div ref={reel} key={idle ? 'idle' : spinId} className={'flex w-max will-change-transform ' + (idle ? 'animate-marquee' : '')}>
            {cards.map((g, i) => (
              <div
                key={i}
                style={{ marginRight: CARD_GAP }}
                className={'w-[158px] shrink-0 transition duration-500 ' + (phase === 'done' ? (i === REEL_WIN ? 'scale-105' : 'opacity-30 saturate-50') : '')}
              >
                <Poster game={g} className={phase === 'done' && i === REEL_WIN ? 'ring-2 ring-white shadow-[0_0_40px_-4px_var(--tint)]' : ''} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-muted">{loading ? 'Carregando seus jogos…' : onlyFav ? 'Nenhum jogo da sua lista com esses filtros.' : 'Nenhum jogo com esses filtros.'}</div>
        )}
        {/* moldura do centro, com as duas setinhas */}
        <div ref={frame} aria-hidden className={'pointer-events-none absolute inset-y-3 left-1/2 w-[176px] -translate-x-1/2 rounded-xl border-2 border-tint transition-opacity ' + (phase === 'done' ? 'opacity-0' : 'opacity-90')}>
          <span className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-tint" />
          <span className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-tint" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-ink),transparent_18%,transparent_82%,var(--color-ink))]" />
        {phase === 'done' && winner && <Burst key={'burst' + spinId} color={winner.color} />}
      </div>

      <div className="gutter mt-6 flex flex-col items-center gap-2">
        <button
          onClick={spin}
          disabled={!pool.length || phase === 'spinning'}
          className="inline-flex h-16 items-center gap-3 rounded-2xl bg-fg px-9 font-display text-2xl font-extrabold text-ink shadow-[0_10px_40px_-10px_var(--tint)] transition hover:scale-105 hover:bg-white active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          <Dices size={26} strokeWidth={2.2} className={phase === 'spinning' ? 'animate-spin' : ''} />
          {phase === 'spinning' ? 'Girando…' : winner ? 'Girar de novo' : 'Sortear'}
        </button>
        <span className="hidden text-xs text-muted md:block">
          ou aperte <kbd className="rounded border border-line px-1.5 py-0.5 font-mono">espaço</kbd>
        </span>
      </div>

      {winner && (
        <div ref={result} className="gutter mt-8">
          <div className="mx-auto flex max-w-3xl animate-rise flex-col gap-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-line sm:flex-row sm:p-7">
            <button onClick={() => openGame(winner.key)} aria-label={`Detalhes de ${winner.title}`} className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
              <Poster game={winner} w={480} className="shadow-2xl shadow-black/60" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold tracking-[.12em] uppercase brightness-150" style={{ color: winner.color }}>
                Hoje você joga · {[winner.consoleName, ...winner.path].join(' / ')}
              </div>
              <h2 className="display mt-2 text-[clamp(30px,5vw,48px)]">{winner.title}</h2>
              <div className="mt-2 mb-4 flex items-center gap-2 font-mono text-xs text-muted">
                {[winner.ext.toUpperCase(), fmtSize(winner.size)].filter(Boolean).join(' · ')}
                {winner.pt && <PtFlag />}
              </div>
              <Synopsis game={winner} />
              <div className="mt-5 flex flex-wrap gap-2">
                <a className={btnPlay} href={downloadUrl(winner)} target="_blank" rel="noopener">
                  <Download size={18} strokeWidth={2.6} />
                  Baixar
                </a>
                <button className={btnSoft} onClick={() => openGame(winner.key)}>
                  <Info size={18} strokeWidth={2.4} />
                  Detalhes
                </button>
                <FavButton game={winner} variant="button" />
              </div>
              {winConsole && <EmuHint console={winConsole} />}
            </div>
          </div>
        </div>
      )}

      {history.length > 1 && <GameRail title="Sorteados agora há pouco" games={history.slice(1)} />}
    </>
  );
}
