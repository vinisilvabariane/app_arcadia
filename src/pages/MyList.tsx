import { Heart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GameGrid } from '../components/GameGrid';
import { btnPlay, PageHero, Segmented } from '../components/ui';
import { plural } from '../lib/format';
import { useTint } from '../lib/useTint';
import { useFavs } from '../store/favorites';
import { useLibrary, useStillLoading } from '../store/library';

type ListSort = 'added' | 'az';

export function MyList() {
  useTint('#ff5470');
  const favs = useFavs((s) => s.favs);
  const byKey = useLibrary((s) => s.byKey);
  const loading = useStillLoading();
  const [sort, setSort] = useState<ListSort>('added');

  const list = useMemo(() => {
    const l = Object.keys(favs).map((k) => byKey[k]).filter(Boolean);
    return sort === 'az' ? l.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')) : l.sort((a, b) => favs[b.key] - favs[a.key]);
  }, [favs, byKey, sort]);
  const missing = Object.keys(favs).length - list.length;

  return (
    <>
      <PageHero eyebrow="Seus favoritos" title="Minha lista">
        {list.length ? (
          <>
            <b>{plural(list.length, 'jogo guardado', 'jogos guardados')}</b> neste navegador.
          </>
        ) : (
          'Guarde aqui os jogos que você quer achar rápido.'
        )}
        {missing > 0 && loading && ` Carregando mais ${missing}…`}
      </PageHero>
      <section className="gutter mt-6">
        {list.length ? (
          <>
            <div className="mb-5">
              <Segmented
                label="Ordenar"
                value={sort}
                onChange={setSort}
                options={[
                  ['added', 'Adicionados por último'],
                  ['az', 'A–Z'],
                ]}
              />
            </div>
            <GameGrid games={list} resetKey={sort} />
          </>
        ) : (
          <div className="mx-auto max-w-sm py-12 text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-heart/15 text-heart">
              <Heart size={36} className="fill-heart" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold">Sua lista está vazia</h3>
            <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">Toque no coração de um jogo pra guardar ele aqui. A lista fica salva neste navegador.</p>
            <Link to="/" className={btnPlay}>
              Explorar jogos
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
