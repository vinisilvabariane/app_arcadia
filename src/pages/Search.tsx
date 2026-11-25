import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GameGrid } from '../components/GameGrid';
import { Chip, ChipStrip, EmptyBox, SortTabs } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { FRANCHISES } from '../data/franchises';
import { fmtNum, plural } from '../lib/format';
import { franchiseGames, searchGames, sortList } from '../lib/games';
import { useTint } from '../lib/useTint';
import { useLibrary, useStillLoading } from '../store/library';
import { useUi } from '../store/ui';

/* Resultados da busca. A URL guarda tudo:
   ?q=texto   &c=id,id (consoles)   &f=id (franquia)
   Quando a busca começa dentro de um console ou franquia, ela já vem restrita a ele. */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const filters = useMemo(() => (params.get('c') || '').split(',').filter(Boolean), [params]);
  const franchise = FRANCHISES.find((f) => f.id === params.get('f'));

  const all = useLibrary((s) => s.all);
  const consoles = useLibrary((s) => s.consoles);
  const byId = useLibrary((s) => s.byId);
  const sort = useUi((s) => s.sort);
  const loading = useStillLoading();

  // onde procurar: só os jogos da franquia, ou o acervo todo
  const pool = useMemo(() => (franchise ? franchiseGames(all, franchise) : all), [all, franchise]);
  const hits = useMemo(() => searchGames(pool, q), [pool, q]);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    hits.forEach((g) => (by[g.consoleId] = (by[g.consoleId] || 0) + 1));
    return by;
  }, [hits]);
  const shown = useMemo(() => sortList(filters.length ? hits.filter((g) => filters.includes(g.consoleId)) : hits, sort), [hits, filters, sort]);

  const only = filters.length === 1 ? byId[filters[0]] : undefined;
  useTint(only ? only.info.color : franchise ? franchise.color : HOME_TINT);

  const update = (change: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params);
    change(p);
    setParams(p, { replace: true });
  };
  const setFilters = (next: string[]) => update((p) => (next.length ? p.set('c', next.join(',')) : p.delete('c')));
  const toggle = (id: string) => setFilters(filters.includes(id) ? filters.filter((x) => x !== id) : [...filters, id]);
  const everywhere = () =>
    update((p) => {
      p.delete('c');
      p.delete('f');
    });
  const scoped = filters.length > 0 || !!franchise;

  return (
    <>
      <section className="gutter pt-8">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Resultados para <em className="text-tint-hi not-italic">{q}</em>
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted">
          <span>{plural(shown.length, 'jogo encontrado', 'jogos encontrados')}</span>
          {franchise && (
            <button onClick={() => update((p) => p.delete('f'))} title="Tirar o filtro de franquia" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink-2 pr-2 pl-2.5 text-xs font-semibold text-fg ring-1 ring-line transition hover:bg-ink-3">
              <span className="size-2 rounded-full" style={{ background: franchise.color }} />
              na franquia {franchise.name}
              <X size={13} strokeWidth={2.8} className="text-muted" />
            </button>
          )}
          <span>{filters.length ? 'em ' + filters.map((id) => byId[id]?.name || '?').join(', ') : franchise ? '' : 'em todo o acervo'}</span>
          {scoped && (
            <button onClick={everywhere} className="font-semibold text-fg underline-offset-2 hover:underline">
              Buscar em todo o acervo
            </button>
          )}
          {loading && <span>· alguns consoles ainda estão carregando</span>}
        </div>
      </section>

      <ChipStrip label="Filtrar por console">
        <Chip on={!filters.length} count={fmtNum(hits.length)} onClick={() => setFilters([])}>
          Todos
        </Chip>
        {consoles.map((c) => {
          const on = filters.includes(c.id);
          const n = counts[c.id] || 0;
          if (!n && !on) return null;
          return (
            <Chip key={c.id} on={on} color={c.info.color} count={fmtNum(n)} onClick={() => toggle(c.id)}>
              {c.name}
            </Chip>
          );
        })}
      </ChipStrip>

      <section className="gutter mt-3">
        <div className="mb-5">
          <SortTabs />
        </div>
        {shown.length ? (
          <GameGrid games={shown} resetKey={q + filters.join() + (franchise?.id || '') + sort} />
        ) : (
          <EmptyBox>
            Nenhum jogo com <b>{q}</b>
            {scoped ? (
              <>
                {' '}
                {franchise && !filters.length ? 'nessa franquia' : 'nesse filtro'}.{' '}
                <button className="font-bold text-fg underline" onClick={everywhere}>
                  Buscar em todo o acervo
                </button>
              </>
            ) : (
              '. Confira a grafia ou tente só uma palavra do nome.'
            )}
          </EmptyBox>
        )}
      </section>
    </>
  );
}
