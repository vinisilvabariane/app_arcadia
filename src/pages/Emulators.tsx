import { ArrowUpRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Chip, ChipStrip, cvar, EmptyBox, PageHero } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { EMULATORS, emusFor } from '../data/emulators';
import { useTint } from '../lib/useTint';
import { useLibrary } from '../store/library';
import type { Emulator } from '../types';

function EmuCard({ emu: e, mine, wide }: { emu: Emulator; mine: Record<string, string>; wide: boolean }) {
  return (
    <article style={cvar(e.color)} className={'relative flex flex-col gap-3.5 overflow-hidden rounded-2xl bg-ink-2 p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-white/25 ' + (wide ? 'sm:col-span-2' : '')}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-(--c)" />
      <div aria-hidden className="absolute -top-16 -right-16 size-44 bg-[radial-gradient(closest-side,var(--c),transparent)] opacity-25" />
      <div className="relative">
        <div className="display text-3xl">{e.name}</div>
        <div className="mt-1 text-[13px] font-semibold text-[color-mix(in_srgb,var(--c)_55%,white)]">{e.for}</div>
      </div>
      <p className="relative text-sm leading-relaxed text-fg/75">{e.desc}</p>
      <div className="relative flex flex-wrap gap-1">
        {e.covers.map((sh) =>
          mine[sh] ? (
            <span key={sh} style={{ background: mine[sh] }} className="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
              {sh}
            </span>
          ) : (
            <span key={sh} className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {sh}
            </span>
          ),
        )}
      </div>
      <div className="relative mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="font-mono text-[11px] text-muted">{e.os}</span>
        <a href={e.url} target="_blank" rel="noopener" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-fg px-3 text-[13px] font-bold text-ink transition hover:bg-white">
          Site oficial
          <ArrowUpRight size={15} strokeWidth={2.6} />
        </a>
      </div>
    </article>
  );
}

/** Links oficiais de emuladores; ?console=id filtra pelos que rodam aquele console. */
export function Emulators() {
  const [params, setParams] = useSearchParams();
  const consoles = useLibrary((s) => s.shelf);
  const f = useLibrary((s) => s.byId[params.get('console') || '']);
  useTint(f ? f.info.color : HOME_TINT);

  // siglas dos consoles que existem no Drive -> cor (ficam coloridas nos cards)
  const mine = Object.fromEntries(consoles.map((c) => [c.info.short, c.info.color]));
  const list = f ? emusFor(f.info.short) : EMULATORS;
  const hasSwitch = consoles.some((c) => /^(Switch|NS2)$/.test(c.info.short));
  const setFilter = (id: string) => setParams(id ? { console: id } : {}, { replace: true });

  return (
    <>
      <PageHero eyebrow="Pra jogar suas ROMs" title="Emuladores">
        Todos gratuitos. <b>Baixe sempre pelo site oficial</b>: versões de outros sites costumam vir com vírus. As siglas coloridas são os consoles que você tem no Drive.
      </PageHero>
      <ChipStrip label="Filtrar por console">
        <Chip on={!f} onClick={() => setFilter('')}>
          Todos
        </Chip>
        {consoles
          .filter((c) => emusFor(c.info.short).length)
          .map((c) => (
            <Chip key={c.id} on={f?.id === c.id} color={c.info.color} onClick={() => setFilter(c.id)}>
              {c.name}
            </Chip>
          ))}
      </ChipStrip>
      <section className="gutter mt-3">
        {list.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((e) => (
              <EmuCard key={e.name} emu={e} mine={mine} wide={!!e.wide && !f} />
            ))}
          </div>
        ) : (
          <EmptyBox>Nenhum emulador listado pra esse console.</EmptyBox>
        )}
        {hasSwitch && !f && (
          <div className="mt-5 rounded-xl bg-ink-2 p-4 text-sm leading-relaxed text-muted ring-1 ring-line [&_b]:text-fg">
            <b>Switch e Switch 2:</b> não listamos emulador aqui. Os projetos mudam muito e vários foram encerrados, então pesquise com cuidado antes de baixar qualquer coisa.
          </div>
        )}
      </section>
    </>
  );
}
