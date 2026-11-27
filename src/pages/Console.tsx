import { ChevronLeft, ChevronRight, Dices, Download, Folder, Gamepad2, Info } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FavButton } from '../components/FavButton';
import { GameGrid } from '../components/GameGrid';
import { PlayButton } from '../components/PlayButton';
import { Poster, useBlurBg } from '../components/Poster';
import { GameRail } from '../components/Rail';
import { Tile, tileGrid } from '../components/Tile';
import { btnPlay, btnSoft, Chip, ChipStrip, EmptyBox, Eyebrow, PageHero, SectionHead, SortTabs, Tag } from '../components/ui';
import { HOME_TINT, isPtBr } from '../data/consoles';
import { emusFor } from '../data/emulators';
import { fmtSize, plural, rnd } from '../lib/format';
import { consolePath, downloadUrl, inPath, pickCovers, sortList, subfolders, totalSize } from '../lib/games';
import { useTint } from '../lib/useTint';
import { useLibrary } from '../store/library';
import { useUi } from '../store/ui';
import type { Game, GameConsole } from '../types';

/** "Como jogar: Snes9x, Mesen…" — leva pra página de emuladores já filtrada. */
export function EmuHint({ console: c }: { console: GameConsole }) {
  const list = emusFor(c.info.short).slice(0, 3);
  if (!list.length) return null;
  return (
    <Link to={'/emuladores?console=' + encodeURIComponent(c.id)} className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg px-1 py-1 text-[13px] text-muted transition hover:text-fg">
      <Gamepad2 size={17} strokeWidth={2.2} className="shrink-0" />
      <span className="truncate">
        Como jogar: <b className="font-semibold text-fg">{list.map((e) => e.name).join(', ')}</b>
      </span>
      <ChevronRight size={14} strokeWidth={2.6} className="shrink-0" />
    </Link>
  );
}

/** Destaque grande no topo da página do console. */
function Billboard({ game: g, console: c, onShuffle }: { game: Game; console: GameConsole; onShuffle: () => void }) {
  const bg = useBlurBg(g);
  const openGame = useUi((s) => s.openGame);
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-40" style={bg ? { backgroundImage: `url('${bg}')` } : { background: c.info.color }} />
      <div aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent to-ink" />
      <div key={g.key} className="gutter relative flex animate-rise flex-col gap-6 py-8 sm:flex-row sm:items-center sm:gap-9 sm:py-12">
        <div className="w-36 shrink-0 sm:w-52">
          <Poster game={g} w={480} className="rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/15" />
        </div>
        <div className="min-w-0">
          <Eyebrow>{c.name} · em destaque</Eyebrow>
          <h2 className="display mt-2 line-clamp-3 text-[clamp(34px,5.5vw,68px)]">{g.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {g.tags.map((t, i) => (
              <Tag key={i}>{t}</Tag>
            ))}
            {g.size > 0 && <span className="ml-1 font-mono text-xs text-muted">{fmtSize(g.size)}</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <PlayButton game={g} />
            <a className={btnPlay} href={downloadUrl(g)} target="_blank" rel="noopener">
              <Download size={18} strokeWidth={2.6} />
              {g.folder ? 'Abrir pasta' : 'Baixar'}
            </a>
            <button className={btnSoft} onClick={() => openGame(g.key)}>
              <Info size={18} strokeWidth={2.4} />
              Detalhes
            </button>
            <FavButton game={g} variant="button" />
            <button className={btnSoft} onClick={onShuffle} title="Sortear outro destaque">
              <Dices size={18} strokeWidth={2.2} />
              Sortear
            </button>
          </div>
          <EmuHint console={c} />
        </div>
      </div>
    </section>
  );
}

/** Página de um console. Com `recomps`, é a página da pasta RECOMPS (sem faixa de consoles nem destaque). */
export function ConsolePage({ recomps = false }: { recomps?: boolean }) {
  const params = useParams();
  const recompsId = useLibrary((s) => s.recompsId);
  const id = recomps ? recompsId || '' : params.id || '';
  const splat = params['*'] || '';
  const path = useMemo(() => (splat ? splat.split('/').filter(Boolean) : []), [splat]);

  const consoles = useLibrary((s) => s.shelf);
  const c = useLibrary((s) => s.byId[id]);
  const status = useLibrary((s) => s.status);
  const sort = useUi((s) => s.sort);
  const navigate = useNavigate();
  useLibrary((s) => s.coverTick);
  useTint(c ? c.info.color : HOME_TINT);

  const [featured, setFeatured] = useState<Game | null>(null);
  useEffect(() => setFeatured(null), [id]);

  const games = c?.games;
  const view = useMemo(() => {
    if (!games) return null;
    const inside = games.filter((g) => inPath(g, path));
    const direct = inside.filter((g) => g.path.length === path.length);
    return { inside, direct, subs: subfolders(inside, path) };
  }, [games, path]);
  const sorted = useMemo(() => (view ? sortList(view.direct, sort) : []), [view, sort]);

  const isRecomps = !!c && c.id === recompsId;
  const chips = isRecomps ? null : (
    <ChipStrip label="Consoles" centerOn={id + consoles.length}>
      <Chip color={HOME_TINT} onClick={() => navigate('/consoles')}>
        Todos os consoles
      </Chip>
      {consoles.map((x) => (
        <Chip key={x.id} on={x.id === id} color={x.info.color} count={x.games ? x.games.length : null} onClick={() => navigate(consolePath(x.id))}>
          {x.name}
        </Chip>
      ))}
    </ChipStrip>
  );

  if (!c) {
    return (
      <div className="gutter py-10">
        <EmptyBox>{status === 'loading' ? 'Carregando…' : recomps ? <>Não achei uma pasta <b>RECOMPS</b> na raiz do Drive.</> : <>Console não encontrado. <Link to="/consoles" className="font-bold text-fg underline">Ver todos os consoles</Link></>}</EmptyBox>
      </div>
    );
  }
  if (!view) {
    return (
      <>
        {chips}
        <div className="gutter py-6">
          <EmptyBox>Carregando {c.name}…</EmptyBox>
        </div>
      </>
    );
  }
  if (!games!.length) {
    return (
      <>
        {chips}
        <div className="gutter py-6">
          <EmptyBox>
            <b>{c.name}</b> ainda está vazio. Coloque ROMs nessa pasta do Drive e clique em recarregar.
          </EmptyBox>
        </div>
      </>
    );
  }

  const { inside, direct, subs } = view;
  const folders = subs.length > 0 && (
    <section className="gutter mt-8">
      <SectionHead title="Pastas" note={subs.length} />
      <div className={tileGrid}>
        {subs.map((s) => (
          <Tile
            key={s.name}
            to={consolePath(id, [...path, s.name])}
            color={c.info.color}
            covers={pickCovers(s.items, 3)}
            title={s.name}
            count={plural(s.items.length, 'arquivo', 'arquivos') + ' · ' + fmtSize(totalSize(s.items))}
            corner={<Folder size={20} strokeWidth={2.2} />}
          />
        ))}
      </div>
    </section>
  );

  let top;
  if (isRecomps && !path.length) {
    top = (
      <>
        <PageHero eyebrow="Jogos recompilados pra PC" title="Recomps">
          Ports nativos feitos a partir dos jogos originais: rodam direto no computador, sem emulador.{' '}
          <b>{plural(inside.length, 'arquivo', 'arquivos')}</b> · {fmtSize(totalSize(inside))}
        </PageHero>
        {folders}
      </>
    );
  } else if (!path.length) {
    // Destaque: prefere arquivos soltos ou de uma pasta chamada "Jogos"/"Games".
    let pool = direct.length ? direct : inside.filter((g) => /jogo|game|rom/i.test(g.path[0] || ''));
    if (!pool.length) pool = inside;
    const f = featured && inside.includes(featured) ? featured : pickCovers(pool, 1)[0] || pool[0];
    const pt = c.ptbr ? [] : inside.filter((g) => isPtBr(g.base));
    top = (
      <>
        <Billboard game={f} console={c} onShuffle={() => setFeatured(inside[rnd(inside.length)])} />
        {folders}
        <GameRail title="Em português" games={pt.slice(0, 30)} count={pt.length} />
      </>
    );
  } else {
    top = (
      <>
        <section className="gutter animate-rise pt-6">
          <nav aria-label="Caminho" className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link to={consolePath(id)} className="hover:text-fg">
              {c.name}
            </Link>
            {path.map((p, i) => (
              <Fragment key={i}>
                <span>/</span>
                {i === path.length - 1 ? (
                  <b className="text-fg">{p}</b>
                ) : (
                  <Link to={consolePath(id, path.slice(0, i + 1))} className="hover:text-fg">
                    {p}
                  </Link>
                )}
              </Fragment>
            ))}
          </nav>
          <h2 className="display mt-3 text-[clamp(34px,5.5vw,64px)]">{path[path.length - 1]}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
            <span className="font-mono">
              {plural(inside.length, 'arquivo', 'arquivos')} · {fmtSize(totalSize(inside))}
            </span>
            {subs.length > 0 && <span>· {plural(subs.length, 'subpasta', 'subpastas')}</span>}
          </div>
          <Link to={consolePath(id, path.slice(0, -1))} className={btnSoft + ' mt-4'}>
            <ChevronLeft size={18} strokeWidth={2.6} />
            Voltar
          </Link>
        </section>
        {folders}
      </>
    );
  }

  return (
    <>
      {chips}
      {top}
      {direct.length > 0 && (
        <section className="gutter mt-10">
          <SectionHead title={path.length ? 'Arquivos' : subs.length ? 'Arquivos soltos' : 'Todos os jogos'} note={plural(direct.length, 'arquivo', 'arquivos') + ' · ' + fmtSize(totalSize(direct))}>
            <SortTabs />
          </SectionHead>
          <GameGrid games={sorted} resetKey={id + '/' + splat + sort} />
        </section>
      )}
    </>
  );
}
