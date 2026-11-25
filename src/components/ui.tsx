import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useUi } from '../store/ui';
import type { SortKey } from '../types';

/* Peças pequenas reaproveitadas pelas páginas. */

const btnBase =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold whitespace-nowrap transition active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none';
/** botão principal (Baixar) */
export const btnPlay = btnBase + ' bg-fg text-ink hover:bg-white';
/** botão secundário */
export const btnSoft = btnBase + ' bg-white/12 text-fg hover:bg-white/20';

/** variável CSS --c num style (o TypeScript não conhece variáveis soltas) */
export const cvar = (color: string, extra?: CSSProperties) => ({ '--c': color, ...extra }) as CSSProperties;

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={'text-xs font-bold tracking-[.14em] uppercase text-tint brightness-150 ' + className}>{children}</div>;
}

/** Cabeçalho de página: sobrelinha, título gigante e uma frase. */
export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <section className="gutter max-w-4xl animate-rise pt-10 pb-2 sm:pt-14">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="display mt-2 mb-3 text-[clamp(48px,8vw,104px)]">{title}</h1>
      {children && <p className="max-w-[60ch] text-base leading-relaxed text-muted [&_b]:font-semibold [&_b]:text-fg">{children}</p>}
    </section>
  );
}

export function SectionHead({ title, note, children }: { title?: string; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
      {title && <h3 className="font-display text-xl font-bold sm:text-2xl">{title}</h3>}
      {note != null && <span className="font-mono text-xs text-muted">{note}</span>}
      {children && <div className="ml-auto">{children}</div>}
    </div>
  );
}

/** Grupo de botões "um ligado por vez" (ordenação). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-ink-2 p-1 ring-1 ring-line">
      {options.map(([v, text]) => (
        <button
          key={v}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={'rounded-md px-3 py-1.5 text-[13px] font-semibold transition ' + (value === v ? 'bg-ink-3 text-fg shadow' : 'text-muted hover:text-fg')}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const SORTS: [SortKey, string][] = [
  ['az', 'A–Z'],
  ['recent', 'Recentes'],
  ['size', 'Tamanho'],
];
export function SortTabs() {
  const sort = useUi((s) => s.sort);
  const setSort = useUi((s) => s.setSort);
  return <Segmented label="Ordenar" value={sort} onChange={setSort} options={SORTS} />;
}

/** Etiqueta arredondada; com `color` ganha uma bolinha da cor do console. */
export function Chip({ on, color, count, children, ...rest }: { on?: boolean; color?: string; count?: number | string | null; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-pressed={!!on}
      style={color ? cvar(color) : undefined}
      className={
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap ring-1 transition ' +
        (on ? 'bg-fg text-ink ring-fg' : 'bg-ink-2 text-fg/85 ring-line hover:bg-ink-3 hover:text-fg')
      }
      {...rest}
    >
      {color && <span className="size-2.5 rounded-full bg-(--c)" />}
      {children}
      {count != null && <span className={'font-mono text-[11px] ' + (on ? 'text-ink/60' : 'text-muted')}>{count}</span>}
    </button>
  );
}

/** Faixa de chips que rola de lado. */
export function ChipStrip({ label, centerOn, children }: { label: string; centerOn?: string; children: ReactNode }) {
  const nav = useRef<HTMLElement>(null);
  // centerOn mudou (trocou de console): traz o chip ligado pro meio da faixa
  useEffect(() => {
    const el = nav.current;
    const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && on) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2;
  }, [centerOn]);
  return (
    <nav ref={nav} aria-label={label} className="no-scrollbar fade-x gutter relative flex gap-2 overflow-x-auto py-3">
      {children}
    </nav>
  );
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-muted [&_b]:text-fg">{children}</div>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium text-fg/85">{children}</span>;
}

export function PtFlag({ className = '' }: { className?: string }) {
  return <span className={'rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-wide text-black ' + className}>PT-BR</span>;
}
