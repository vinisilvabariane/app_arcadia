import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GameGrid } from '../components/GameGrid';
import { Chip, ChipStrip, EmptyBox, SortTabs } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { fmtNum, plural } from '../lib/format';
import { searchGames, sortList } from '../lib/games';
import { useTint } from '../lib/useTint';
import { useLibrary, useStillLoading } from '../store/library';
import { useUi } from '../store/ui';

/** Resultados da busca. A URL guarda o texto (?q=) e os consoles filtrados (&c=id,id). */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const filters = useMemo(() => (params.get('c') || '').split(',').filter(Boolean), [params]);

  const all = useLibrary((s) => s.all);
  const consoles = useLibrary((s) => s.consoles);
  const byId = useLibrary((s) => s.byId);
  const sort = useUi((s) => s.sort);
  const loading = useStillLoading();

  const hits = useMemo(() => searchGames(all, q), [all, q]);
  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    hits.forEach((g) => (by[g.consoleId] = (by[g.consoleId] || 0) + 1));
    return by;
  }, [hits]);
  const shown = useMemo(() => sortList(filters.length ? hits.filter((g) => filters.includes(g.consoleId)) : hits, sort), [hits, filters, sort]);

  const only = filters.length === 1 ? byId[filters[0]] : undefined;
  useTint(only ? only.info.color : HOME_TINT);

  const setFilters = (next: string[]) => {
    const p = new URLSearchParams(params);
    if (next.length) p.set('c', next.join(','));
    else p.delete('c');
    setParams(p, { replace: true });
  };
  const toggle = (id: string) => setFilters(filters.includes(id) ? filters.filter((x) => x !== id) : [...filters, id]);

  return (
    <>
      <section className="gutter pt-8">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Resultados para <em className="text-tint-hi not-italic">{q}</em>
        </h2>
        <div className="mt-2 text-sm text-muted">
          {plural(shown.length, 'jogo encontrado', 'jogos encontrados')}
          {filters.length ? ' em ' + filters.map((id) => byId[id]?.name || '?').join(', ') : ' em todos os consoles'}
          {loading && ' · alguns consoles ainda estão carregando'}
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
          <GameGrid games={shown} resetKey={q + filters.join() + sort} />
        ) : (
          <EmptyBox>
            Nenhum jogo com <b>{q}</b>
            {filters.length ? (
              <>
                {' '}
                nos consoles filtrados.{' '}
                <button className="font-bold text-fg underline" onClick={() => setFilters([])}>
                  Buscar em todos
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
