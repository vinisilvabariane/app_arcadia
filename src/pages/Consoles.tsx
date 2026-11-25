import { useMemo } from 'react';
import { GameRail } from '../components/Rail';
import { Tile, tileGrid, TileSkeletons } from '../components/Tile';
import { PageHero, PtFlag } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { fmtNum, plural } from '../lib/format';
import { byNewest, consolePath, pickCovers } from '../lib/games';
import { useTint } from '../lib/useTint';
import { useLibrary, useStillLoading } from '../store/library';

export function Consoles() {
  useTint(HOME_TINT);
  const consoles = useLibrary((s) => s.shelf);
  const all = useLibrary((s) => s.all);
  useLibrary((s) => s.coverTick);
  const loading = useStillLoading();
  const recent = useMemo(() => byNewest(all, 30), [all]);

  return (
    <>
      <PageHero eyebrow="Sua coleção" title="Qual console hoje?">
        {consoles.length ? (
          <>
            <b>{consoles.length}</b> consoles · <b>{fmtNum(consoles.reduce((n, c) => n + (c.games?.length || 0), 0))}</b> jogos{loading && ' até agora'}
          </>
        ) : (
          'Lendo suas pastas no Drive…'
        )}
      </PageHero>
      <section className={'gutter mt-6 ' + tileGrid}>
        {consoles.length ? (
          consoles.map((c) => (
            <Tile
              key={c.id}
              to={consolePath(c.id)}
              color={c.info.color}
              covers={c.games ? pickCovers(c.games, 3) : []}
              title={c.info.short}
              subtitle={c.name.replace(/\([^)]*\)/g, '').trim()}
              count={c.games ? plural(c.games.length, 'jogo', 'jogos') : 'carregando…'}
              corner={c.ptbr ? <PtFlag /> : undefined}
            />
          ))
        ) : (
          <TileSkeletons />
        )}
      </section>
      <GameRail title="Adicionados recentemente" games={recent} />
    </>
  );
}
