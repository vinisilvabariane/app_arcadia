import { Download, Folder, SquareArrowOutUpRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtDate, fmtSize, hash } from '../lib/format';
import { consolePath, downloadUrl, driveUrl } from '../lib/games';
import { useLibrary } from '../store/library';
import { useUi } from '../store/ui';
import { FavButton } from './FavButton';
import { GameCard } from './GameCard';
import { Poster, useBlurBg } from './Poster';
import { Synopsis } from './Synopsis';
import { btnPlay, btnSoft, Tag } from './ui';

/** Detalhes de um jogo, por cima da página. */
export function GameModal() {
  const key = useUi((s) => s.modalKey);
  const close = useUi((s) => s.closeGame);
  const g = useLibrary((s) => (key ? s.byKey[key] : undefined));
  const c = useLibrary((s) => (g ? s.byId[g.consoleId] : undefined));
  const navigate = useNavigate();
  const bg = useBlurBg(g);
  const scroller = useRef<HTMLDivElement>(null);
  const mainBtn = useRef<HTMLAnchorElement>(null);

  // trava a rolagem da página de trás e volta o modal pro topo a cada jogo
  useEffect(() => {
    if (!g) return;
    document.body.style.overflow = 'hidden';
    scroller.current?.scrollTo(0, 0);
    mainBtn.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = '';
    };
  }, [g]);

  // "Mais de…": da mesma pasta; se for o único, do console todo
  const more = useMemo(() => {
    if (!g || !c?.games) return [];
    const folder = g.path.join('/');
    const same = c.games.filter((x) => x !== g && x.path.join('/') === folder);
    const list = same.length ? same : c.games.filter((x) => x !== g);
    const start = hash(g.key) % Math.max(1, list.length);
    return list.slice(start).concat(list.slice(0, start)).slice(0, 6);
  }, [g, c]);

  if (!g || !c) return null;

  return (
    <div ref={scroller} className="fixed inset-0 z-50 animate-fade overflow-y-auto bg-black/75 backdrop-blur-sm sm:p-6" onClick={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label={g.title} className="relative mx-auto min-h-full max-w-4xl animate-rise overflow-hidden bg-ink-2 shadow-2xl ring-line sm:min-h-0 sm:rounded-2xl sm:ring-1">
        <button onClick={close} aria-label="Fechar" className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/90">
          <X size={18} strokeWidth={2.6} />
        </button>

        <div className="relative flex flex-col gap-6 p-5 pt-14 sm:flex-row sm:p-8">
          <div aria-hidden className="absolute inset-0 scale-125 bg-cover bg-center opacity-45 blur-2xl" style={bg ? { backgroundImage: `url('${bg}')` } : { background: g.color }} />
          <div aria-hidden className="absolute inset-0 bg-linear-to-b from-ink-2/30 to-ink-2" />
          <div className="relative mx-auto w-40 shrink-0 sm:mx-0 sm:w-52">
            <Poster game={g} w={480} badge className="shadow-2xl shadow-black/60" />
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="text-xs font-bold tracking-[.12em] uppercase brightness-150" style={{ color: g.color }}>
              {[g.consoleName, ...g.path].join(' / ')}
            </div>
            <h2 className="display mt-2 text-[clamp(30px,5vw,48px)]">{g.title}</h2>
            {g.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.tags.map((t, i) => (
                  <Tag key={i}>{t}</Tag>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-x-2 text-sm text-muted">
              {g.size > 0 && <span className="font-mono text-fg/80">{fmtSize(g.size)}</span>}
              {g.size > 0 && <span>·</span>}
              <span>adicionado em {fmtDate(g.updated)}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <a ref={mainBtn} className={btnPlay} href={downloadUrl(g)} target="_blank" rel="noopener">
                <Download size={18} strokeWidth={2.6} />
                {g.folder ? 'Abrir pasta no Drive' : 'Baixar ROM'}
              </a>
              {!g.folder && (
                <a className={btnSoft} href={driveUrl(g)} target="_blank" rel="noopener">
                  <SquareArrowOutUpRight size={17} strokeWidth={2.3} />
                  Abrir no Drive
                </a>
              )}
              <FavButton game={g} variant="button" />
              {g.path.length > 0 && (
                <button
                  className={btnSoft}
                  onClick={() => {
                    close();
                    navigate(consolePath(g.consoleId, g.path));
                  }}
                >
                  <Folder size={18} strokeWidth={2.2} />
                  Ver pasta
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 pt-2 sm:p-8 sm:pt-2">
          <div>
            <h4 className="mb-2 text-xs font-bold tracking-[.12em] text-muted uppercase">Sinopse</h4>
            <Synopsis game={g} />
          </div>
          <div className="rounded-lg bg-ink px-3 py-2.5 font-mono text-xs break-all text-muted ring-1 ring-line">{g.file}</div>
          {g.size > 100 * 1024 * 1024 && (
            <div className="rounded-lg bg-amber-400/10 px-3 py-2.5 text-[13px] text-amber-200 ring-1 ring-amber-400/25">
              Arquivo grande: o Google vai avisar que não consegue verificar vírus. Clique em “Fazer o download assim mesmo”.
            </div>
          )}
          {more.length > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-bold tracking-[.12em] text-muted uppercase">Mais de {g.path.length ? g.path[g.path.length - 1] : c.name}</h4>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {more.map((x) => (
                  <GameCard key={x.key} game={x} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
