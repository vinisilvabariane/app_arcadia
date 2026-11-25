import { Download, Info, Play } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { fmtSize } from '../lib/format';
import { downloadUrl } from '../lib/games';
import { playPath } from '../lib/play';
import { useUi } from '../store/ui';
import type { Game } from '../types';
import { FavButton } from './FavButton';
import { Poster } from './Poster';

/** Card de jogo: capa clicável (abre os detalhes), atalhos de baixar/favoritar e o nome embaixo. */
/** bare = só a capa, sem o nome embaixo (pra fileiras com layout próprio, como o Top 10).
    play = clicar na capa já abre o jogo no emulador (página Jogar); os detalhes viram um atalho. */
export const GameCard = memo(function GameCard({ game: g, bare, play, className = '' }: { game: Game; bare?: boolean; play?: boolean; className?: string }) {
  const openGame = useUi((s) => s.openGame);
  return (
    <div className={'group relative [contain:layout_style] ' + className}>
      {play ? (
        <Link
          to={playPath(g)}
          aria-label={`Jogar ${g.title}, ${g.consoleName}`}
          className="relative block w-full rounded-lg ring-1 ring-white/5 transition-transform duration-200 group-hover:scale-[1.04] group-hover:ring-2 group-hover:ring-white/80"
        >
          <Poster game={g} />
          <span aria-hidden className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
            <span className="grid size-12 place-items-center rounded-full bg-fg text-ink">
              <Play size={22} strokeWidth={2.6} fill="currentColor" className="translate-x-px" />
            </span>
          </span>
        </Link>
      ) : (
        <button
          onClick={() => openGame(g.key)}
          aria-label={`${g.title}, ${g.consoleName}`}
          className="block w-full rounded-lg ring-1 ring-white/5 transition-transform duration-200 group-hover:scale-[1.04] group-hover:ring-2 group-hover:ring-white/80"
        >
          <Poster game={g} />
        </button>
      )}
      {/* atalhos: aparecem no hover; em tela de toque ficam sempre visíveis */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <FavButton game={g} />
        {play && (
          <button onClick={() => openGame(g.key)} title="Detalhes" aria-label={`Detalhes de ${g.title}`} className="grid size-9 place-items-center rounded-full bg-black/70 text-white transition hover:scale-110">
            <Info size={17} strokeWidth={2.4} />
          </button>
        )}
        <a
          href={downloadUrl(g)}
          target="_blank"
          rel="noopener"
          title={g.folder ? 'Abrir pasta' : 'Baixar'}
          aria-label={`Baixar ${g.title}`}
          className="grid size-9 place-items-center rounded-full bg-fg text-ink transition hover:scale-110"
        >
          <Download size={17} strokeWidth={2.6} />
        </a>
      </div>
      {!bare && (
        <>
          <div className="mt-2 line-clamp-2 text-[13px] leading-snug font-semibold text-fg/90">{g.title}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted">{[g.short, ...g.path].join(' / ') + (g.size ? ' · ' + fmtSize(g.size) : '')}</div>
        </>
      )}
    </div>
  );
});
