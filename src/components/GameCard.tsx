import { Download } from 'lucide-react';
import { memo } from 'react';
import { fmtSize } from '../lib/format';
import { downloadUrl } from '../lib/games';
import { useUi } from '../store/ui';
import type { Game } from '../types';
import { FavButton } from './FavButton';
import { Poster } from './Poster';

/** Card de jogo: capa clicável (abre os detalhes), atalhos de baixar/favoritar e o nome embaixo. */
export const GameCard = memo(function GameCard({ game: g, className = '' }: { game: Game; className?: string }) {
  const openGame = useUi((s) => s.openGame);
  return (
    <div className={'group relative [contain:layout_style] ' + className}>
      <button
        onClick={() => openGame(g.key)}
        aria-label={`${g.title}, ${g.consoleName}`}
        className="block w-full rounded-lg ring-1 ring-white/5 transition duration-200 group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-tint"
      >
        <Poster game={g} />
      </button>
      {/* atalhos: aparecem no hover; em tela de toque ficam sempre visíveis */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 transition group-focus-within:opacity-100 group-hover:-translate-y-1 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <FavButton game={g} />
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
      <div className="mt-2 line-clamp-2 text-[13px] leading-snug font-semibold text-fg/90">{g.title}</div>
      <div className="mt-0.5 truncate font-mono text-[11px] text-muted">{[g.short, ...g.path].join(' / ') + (g.size ? ' · ' + fmtSize(g.size) : '')}</div>
    </div>
  );
});
