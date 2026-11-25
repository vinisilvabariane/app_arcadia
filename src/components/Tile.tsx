import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Game } from '../types';
import { Poster, THUMB_IMG_W } from './Poster';
import { cvar } from './ui';

interface Props {
  to: string;
  color: string;
  /** até 3 capas, abertas em leque no canto */
  covers?: Game[];
  title: string;
  subtitle?: string;
  count?: string;
  /** canto superior esquerdo (ícone de pasta, selo PT-BR…) */
  corner?: ReactNode;
  footer?: ReactNode;
}

const FAN = ['right-[78px] rotate-[-14deg] top-7', 'right-[40px] rotate-[-4deg] top-5', 'right-[2px] rotate-[8deg] top-6'];

/** Bloco colorido grande: console, pasta ou franquia. */
export function Tile({ to, color, covers = [], title, subtitle, count, corner, footer }: Props) {
  return (
    <Link
      to={to}
      style={cvar(color, { background: 'linear-gradient(150deg, var(--c), color-mix(in srgb, var(--c) 38%, #0b0c12))' })}
      className="group relative flex h-44 flex-col justify-end overflow-hidden rounded-2xl p-4 ring-1 ring-white/10 transition-transform duration-200 hover:-translate-y-1 hover:ring-white/40 sm:h-48"
    >
      {covers.length > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-1/2 transition duration-300 group-hover:scale-105">
          {covers.slice(0, 3).map((g, i) => (
            <div key={g.key} className={'absolute w-[84px] rounded-lg ring-1 ring-black/40 ' + FAN[i + (3 - Math.min(3, covers.length))]}>
              <Poster game={g} w={THUMB_IMG_W} />
            </div>
          ))}
        </div>
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-black/45 via-black/10 to-transparent" />
      {corner && <div className="absolute top-3 left-3 text-white/90">{corner}</div>}
      <div className="relative max-w-[58%]">
        {/* nomes compridos (franquias, pastas) usam letra menor pra não invadir as capas */}
        <div className={'display line-clamp-3 break-words text-white [text-shadow:0_2px_8px_rgb(0_0_0/.55)] ' + (title.length > 8 ? 'text-[22px] leading-none' : 'text-[clamp(28px,3.2vw,38px)]')}>{title}</div>
        {subtitle && <div className="mt-1 truncate text-[13px] font-semibold text-white/85">{subtitle}</div>}
        {count && <div className="mt-0.5 font-mono text-[11px] text-white/70">{count}</div>}
        {footer}
      </div>
    </Link>
  );
}

export const tileGrid = 'grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4';

export function TileSkeletons({ n = 8 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-2xl bg-ink-3 sm:h-48" />
      ))}
    </>
  );
}
