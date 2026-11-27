import { Download, Maximize, RotateCw, Settings, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { btnGo, btnPlay, btnSoft } from '../components/ui';
import { EJS_DATA } from '../data/play';
import { fmtSize, storage } from '../lib/format';
import { consolePath, downloadUrl } from '../lib/games';
import { downloadRom, PlayError, playCore, romUrl, type Progress } from '../lib/play';
import { getNoCache, getRom, getSave, putRom, putSave, requestPersist } from '../lib/playdb';
import { useTint } from '../lib/useTint';
import { useLibrary } from '../store/library';
import type { Game } from '../types';

/* Tela "Jogar": busca a ROM (cache ou Drive) e roda no EmulatorJS, dentro de um iframe
   descartável (public/player.html). Fica fora do Layout do site: sem barra de busca nem
   atalhos de teclado, pra nada roubar as teclas do jogo. */

/** O que a tela conversa com o quadro do emulador (as funções de public/player.html). */
interface PlayerWindow extends Window {
  startGame(cfg: {
    dataPath: string;
    blob: Blob;
    fileName: string;
    core: string;
    gameName: string;
    color: string;
    biosUrl?: string;
    sram?: Uint8Array;
    on: {
      start(sramOk: boolean): void;
      saveState(data: { state: Uint8Array; screenshot?: Uint8Array }): void;
      loadState(): void;
      sram(bytes: Uint8Array): void;
      escape(): void;
      error(message: string): void;
    };
  }): void;
  loadState(bytes: Uint8Array): void;
  stopGame(): void;
}

const WARNED_KEY = 'arc-play-aviso-experimental';
/** assinatura barata de um save, só pra não regravar o mesmo conteúdo a cada 30 s */
const signature = (b: Uint8Array) => {
  let h = b.length;
  for (let i = 0; i < b.length; i += 13) h = (h * 31 + b[i]) | 0;
  return h;
};

type Phase = 'warn' | 'loading' | 'starting' | 'playing' | 'error';

/** Endereço da BIOS (ex.: neogeo.zip) guardada na mesma pasta do console no Drive. */
function biosFromDrive(g: Game, name: string): string | undefined {
  const c = useLibrary.getState().consoles.find((x) => x.id === g.consoleId);
  const b = c?.games?.find((x) => (x.real || x.file).toLowerCase() === name);
  return b ? romUrl(b.id) : undefined;
}

export function PlayPage() {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useLibrary((s) => s.status);
  const g = useLibrary((s) => s.byKey[key]);
  const stillLoading = useLibrary((s) => s.status === 'loading' || (!s.byKey[key] && s.consoles.some((c) => !c.games)));
  const core = playCore(g);
  useTint(g?.color || '#7c5cff');

  const [phase, setPhase] = useState<Phase>(() => (core?.experimental && !storage.get(WARNED_KEY, false) ? 'warn' : 'loading'));
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rom, setRom] = useState<{ blob: Blob; fromCache: boolean; sram?: Uint8Array } | null>(null);
  const [error, setError] = useState<{ text: string; retry: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** false = o save de bateria guardado não pôde ser restaurado: não deixa o jogo gravar um vazio por cima */
  const sramWritable = useRef(true);
  const lastSram = useRef(0);

  const say = useCallback((text: string) => {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 4000);
  }, []);

  // o jogo só apareceu depois (acervo ainda carregando quando a tela abriu): decide o aviso agora
  useEffect(() => {
    if (core?.experimental && !storage.get(WARNED_KEY, false)) setPhase('warn');
  }, [core?.experimental]);

  /* 1. Busca a ROM: primeiro no cache, senão no Drive. */
  useEffect(() => {
    if (!g || !core || phase !== 'loading') return;
    const ctl = new AbortController();
    setError(null);
    setProgress(null);
    setRom(null);
    (async () => {
      requestPersist();
      const cached = await getRom(g.id);
      let blob = cached?.blob;
      if (!blob) {
        blob = await downloadRom(g, ctl.signal, setProgress);
        if (ctl.signal.aborted) return;
        if (getNoCache()) {
          say('Jogando sem guardar no cache');
        } else {
          const saved = await putRom({ id: g.id, name: g.real || g.file, size: blob.size, blob });
          if (saved === 'too-big') say('ROM maior que o limite do cache: rodando sem guardar');
          else if (saved !== 'saved') say('Navegador sem espaço: rodando sem guardar');
        }
      }
      const sram = await getSave(g.id, 'sram');
      if (ctl.signal.aborted) return;
      setRom({ blob, fromCache: !!cached, sram: sram?.data });
      setPhase('starting');
    })().catch((err) => {
      if (ctl.signal.aborted) return;
      console.error(err);
      setError(err instanceof PlayError ? { text: err.message, retry: err.retry } : { text: 'Não deu pra preparar o jogo.', retry: true });
      setPhase('error');
    });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.id, core?.core, phase === 'loading', attempt]);

  /* 2. O quadro carregou: entrega a ROM e liga os saves. */
  const startFrame = () => {
    const win = frame.current?.contentWindow as PlayerWindow | null;
    if (!win?.startGame || !g || !core || !rom) return;
    sramWritable.current = true;
    lastSram.current = rom.sram ? signature(rom.sram) : 0;
    win.startGame({
      dataPath: EJS_DATA,
      blob: rom.blob,
      // nome verdadeiro: o FBNeo reconhece o jogo de arcade pelo nome curto (kof2002.zip)
      fileName: g.real || g.file,
      core: core.core,
      // identificador estável: o id do Drive (o nome do arquivo pode se repetir entre pastas)
      gameName: g.id,
      color: g.color,
      biosUrl: core.bios || (core.biosFile ? biosFromDrive(g, core.biosFile) : undefined),
      sram: rom.sram,
      on: {
        start(sramOk) {
          if (!sramOk) {
            sramWritable.current = false;
            say('Não deu pra restaurar o save de bateria. Ele continua guardado.');
          }
          setPhase('playing');
          frame.current?.focus();
        },
        saveState(data) {
          // copia: os bytes pertencem ao quadro, que pode ser descartado a qualquer momento
          putSave({ gameId: g.id, kind: 'state', slot: 0, title: g.title, data: new Uint8Array(data.state), screenshot: data.screenshot ? new Uint8Array(data.screenshot) : undefined })
            .then(() => say('Estado salvo neste navegador'))
            .catch(() => say('Não deu pra salvar o estado (sem espaço?)'));
        },
        loadState() {
          getSave(g.id, 'state').then((save) => {
            if (!save) return say('Esse jogo ainda não tem estado salvo');
            (frame.current?.contentWindow as PlayerWindow | null)?.loadState(save.data);
            say('Estado carregado');
          });
        },
        sram(bytes) {
          if (!sramWritable.current) return;
          const copy = new Uint8Array(bytes);
          const sig = signature(copy);
          if (sig === lastSram.current) return;
          lastSram.current = sig;
          putSave({ gameId: g.id, kind: 'sram', slot: 0, title: g.title, data: copy }).catch(() => {});
        },
        escape: () => setAsking(true),
        error(message) {
          setError({ text: message, retry: true });
          setPhase('error');
        },
      },
    });
  };

  /* Sair da tela (qualquer caminho): grava o save de bateria e para o jogo antes do iframe sumir. */
  useEffect(() => {
    const el = frame.current;
    return () => {
      try {
        (el?.contentWindow as PlayerWindow | null)?.stopGame?.();
      } catch {
        /* quadro já descartado */
      }
    };
  }, [rom]);
  // fechar a aba ou recarregar também grava
  useEffect(() => {
    const stop = () => (frame.current?.contentWindow as PlayerWindow | null)?.stopGame?.();
    window.addEventListener('pagehide', stop);
    return () => window.removeEventListener('pagehide', stop);
  }, []);

  const leave = useCallback(() => {
    // veio de dentro do site: volta pra onde estava; abriu direto pelo endereço: vai pro console
    if (location.key !== 'default') navigate(-1);
    else navigate(g ? consolePath(g.consoleId, g.path) : '/', { replace: true });
  }, [navigate, location.key, g]);
  const close = () => (phase === 'playing' ? setAsking(true) : leave());

  // Esc com o foco fora do jogo (com o foco dentro, quem avisa é o próprio quadro)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.fullscreenElement) return;
      if (asking) setAsking(false);
      else if (phase === 'playing') setAsking(true);
      else leave();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [asking, phase, leave]);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.current?.requestFullscreen?.().catch(() => say('Esse navegador não deixou entrar em tela cheia'));
  };

  /* ---------- jogo indisponível ---------- */
  if (!g || !core) {
    const waiting = !g && (status === 'loading' || stillLoading);
    return (
      <Shell title="Jogar" onClose={leave}>
        <div className="relative flex-1">
        <Center>
          {waiting ? (
            <p className="text-muted">Abrindo o acervo…</p>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold">{g ? 'Esse jogo não roda no navegador' : 'Jogo não encontrado'}</h1>
              <p className="mt-2 text-sm text-muted">{g ? 'O console dele ainda não tem emulador aqui, ou o recurso está desligado. Dá pra baixar a ROM normalmente.' : 'Ele pode ter saído do acervo.'}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {g && (
                  <a className={btnPlay} href={downloadUrl(g)} target="_blank" rel="noopener">
                    <Download size={18} strokeWidth={2.6} />
                    Baixar ROM
                  </a>
                )}
                <button className={btnSoft} onClick={leave}>
                  Voltar
                </button>
              </div>
            </>
          )}
        </Center>
        </div>
      </Shell>
    );
  }

  const pct = progress && progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;

  return (
    <Shell
      title={g.title}
      badge={g.short}
      color={g.color}
      experimental={core.experimental}
      note={note || (phase === 'playing' && rom?.fromCache ? 'ROM do cache' : '')}
      onClose={close}
      actions={
        phase === 'playing' && (
          <button onClick={fullscreen} aria-label="Tela cheia" title="Tela cheia" className="grid size-10 place-items-center rounded-lg text-fg/80 transition hover:bg-white/10 hover:text-fg">
            <Maximize size={18} strokeWidth={2.3} />
          </button>
        )
      }
    >
      <div ref={stage} className="relative min-h-0 flex-1 bg-black">
        {rom && (phase === 'starting' || phase === 'playing') && (
          <iframe
            ref={frame}
            key={g.id + ':' + attempt}
            src={import.meta.env.BASE_URL + 'player.html'}
            title={'Emulador: ' + g.title}
            allow="autoplay; fullscreen; gamepad; screen-wake-lock"
            onLoad={startFrame}
            className="absolute inset-0 size-full border-0"
          />
        )}

        {phase === 'warn' && (
          <Center>
            <TriangleAlert size={36} className="mx-auto text-amber-300" />
            <h1 className="mt-3 font-display text-2xl font-bold">{g.short} no navegador é experimental</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">Pode ficar pesado em celular ou PC fraco, e alguns jogos têm falhas de som ou imagem. Se travar, use o Baixar e um emulador instalado.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                className={btnGo}
                onClick={() => {
                  storage.set(WARNED_KEY, true);
                  setPhase('loading');
                }}
              >
                Jogar mesmo assim
              </button>
              <button className={btnSoft} onClick={leave}>
                Voltar
              </button>
            </div>
          </Center>
        )}

        {phase === 'loading' && (
          <Center>
            <h1 className="font-display text-2xl font-bold">Preparando {g.title}</h1>
            <div
              role="progressbar"
              aria-label="Download da ROM"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"
            >
              <div className="h-full rounded-full bg-tint-hi transition-[width] duration-200 motion-reduce:transition-none" style={{ width: pct + '%' }} />
            </div>
            <p className="mt-3 font-mono text-xs text-muted" aria-live="polite">
              {progress
                ? fmtSize(progress.loaded) + ' de ' + fmtSize(progress.total) + ' · ' + pct + '% · ' + fmtSize(progress.speed) + '/s'
                : 'Procurando no cache…'}
            </p>
            <button className={btnSoft + ' mt-5'} onClick={leave}>
              Cancelar
            </button>
          </Center>
        )}

        {phase === 'starting' && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 text-center font-mono text-xs text-white/70">
            {rom?.fromCache ? 'ROM do cache · ' : ''}ligando o emulador…
          </div>
        )}

        {phase === 'error' && error && (
          <Center>
            <TriangleAlert size={36} className="mx-auto text-red-400" />
            <h1 className="mt-3 font-display text-2xl font-bold">Não deu pra jogar agora</h1>
            <p className="mt-2 text-sm leading-relaxed text-fg/80">{error.text}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {error.retry && (
                <button
                  className={btnGo}
                  onClick={() => {
                    setAttempt((n) => n + 1);
                    setPhase('loading');
                  }}
                >
                  <RotateCw size={17} strokeWidth={2.4} />
                  Tentar de novo
                </button>
              )}
              <a className={btnPlay} href={downloadUrl(g)} target="_blank" rel="noopener">
                <Download size={18} strokeWidth={2.6} />
                Baixar ROM
              </a>
              <button className={btnSoft} onClick={leave}>
                Voltar
              </button>
            </div>
          </Center>
        )}

        {asking && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/75 p-5" onClick={(e) => e.target === e.currentTarget && setAsking(false)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="sair-titulo" className="w-full max-w-sm rounded-2xl bg-ink-2 p-6 text-center ring-1 ring-line">
              <h2 id="sair-titulo" className="font-display text-xl font-bold">
                Sair do jogo?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">O save de bateria é gravado ao sair. O ponto exato onde você está só fica se você salvou o estado.</p>
              <div className="mt-5 flex justify-center gap-2">
                <button autoFocus className={btnSoft} onClick={() => setAsking(false)}>
                  Continuar jogando
                </button>
                <button className={btnPlay} onClick={leave}>
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

/** Moldura da tela: barra fina no topo e o resto pro jogo. */
function Shell({
  title,
  badge,
  color,
  experimental,
  note,
  actions,
  onClose,
  children,
}: {
  title: string;
  badge?: string;
  color?: string;
  experimental?: boolean;
  note?: string;
  actions?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-2 sm:px-3">
        <button onClick={onClose} aria-label="Fechar o jogo" title="Fechar (Esc)" className="grid size-10 shrink-0 place-items-center rounded-lg text-fg/80 transition hover:bg-white/10 hover:text-fg">
          <X size={19} strokeWidth={2.5} />
        </button>
        {badge && (
          <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold text-white" style={{ background: color }}>
            {badge}
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-bold">{title}</span>
        {experimental && <span className="hidden shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-200 uppercase sm:block">Experimental</span>}
        <span role="status" className="ml-auto min-w-0 truncate pl-2 text-right font-mono text-[11px] text-muted">
          {note}
        </span>
        {actions}
        <Link to="/cache" aria-label="Cache e saves" title="Cache e saves" className="grid size-10 shrink-0 place-items-center rounded-lg text-fg/80 transition hover:bg-white/10 hover:text-fg">
          <Settings size={18} strokeWidth={2.2} />
        </Link>
      </header>
      {children}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-6">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}
