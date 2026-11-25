import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fmtNum } from '../lib/format';
import type { Game } from '../types';
import { GameCard } from './GameCard';

interface RailProps {
  title: string;
  count?: number | null;
  /** destino do "Ver tudo" */
  more?: string;
  moreLabel?: string;
  className?: string;
  children: ReactNode;
}

/** Fileira que rola de lado, com título e setas (estilo streaming). */
export function Rail({ title, count, more, moreLabel = 'Ver tudo', className = 'mt-9', children }: RailProps) {
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => rail.current?.scrollBy({ left: rail.current.clientWidth * 0.85 * dir, behavior: 'smooth' });
  const arrow = 'absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-ink-2/95 text-fg shadow-xl ring-1 ring-line transition hover:scale-110 hover:bg-ink-3 group-hover/rail:grid [@media(hover:none)]:!hidden';

  return (
    <section className={className + ' [contain-intrinsic-size:auto_340px] [content-visibility:auto]'}>
      <div className="group/head gutter mb-3 flex items-baseline gap-3">
        <h3 className="font-display text-xl font-bold sm:text-[22px]">{title}</h3>
        {count != null && <span className="font-mono text-xs text-muted">{fmtNum(count)}</span>}
        {more && (
          <Link to={more} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-tint-hi opacity-0 transition group-hover/head:opacity-100 hover:underline focus-visible:opacity-100 [@media(hover:none)]:ml-auto [@media(hover:none)]:opacity-100">
            {moreLabel}
            <ChevronRight size={16} strokeWidth={2.6} />
          </Link>
        )}
      </div>
      <div className="group/rail relative">
        <button className={arrow + ' left-3'} onClick={() => scroll(-1)} aria-label="Voltar">
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
        <div ref={rail} className="no-scrollbar gutter flex snap-x gap-3.5 overflow-x-auto scroll-smooth pt-2 pb-2 [scroll-padding-inline:clamp(16px,4vw,64px)]">
          {children}
        </div>
        <button className={arrow + ' right-3'} onClick={() => scroll(1)} aria-label="Avançar">
          <ChevronRight size={22} strokeWidth={2.6} />
        </button>
      </div>
    </section>
  );
}

/* Só monta o conteúdo quando a fileira chega perto da tela.
   A página inicial tem dezenas de fileiras: montar (e baixar as capas de) todas de uma vez travava a rolagem. */
export function LazyMount({ children, height = 340 }: { children: ReactNode; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (shown || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown(true), { rootMargin: '600px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return shown ? <>{children}</> : <div ref={ref} aria-hidden className="mt-9" style={{ height }} />;
}

const CARD_W = 'w-[136px] shrink-0 snap-start sm:w-[168px]';

/** Fileira de jogos. `games` null = ainda carregando (mostra esqueletos). */
export function GameRail({ games, play, ...rest }: Omit<RailProps, 'children'> & { games: Game[] | null; play?: boolean }) {
  if (games && !games.length) return null;
  return (
    <Rail {...rest}>
      {games
        ? games.map((g) => <GameCard key={g.key} game={g} play={play} className={CARD_W} />)
        : Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={CARD_W}>
              <div className="aspect-[3/4] animate-pulse rounded-lg bg-ink-3" />
            </div>
          ))}
    </Rail>
  );
}
