import { Dices, Gamepad2, Heart, Home, Layers, LayoutGrid, Monitor, Play, RefreshCw, Search, Settings, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FRANCHISES } from '../data/franchises';
import { PLAY_ENABLED } from '../lib/play';
import { useFavs } from '../store/favorites';
import { useLibrary } from '../store/library';
import { useUi } from '../store/ui';
import { GameModal } from './GameModal';
import { Logo } from './Logo';

/** tab = nome mais curto pra barra de baixo do celular, onde cada item tem pouco espaço */
const NAV: { to: string; label: string; tab?: string; icon: LucideIcon; also?: string }[] = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/consoles', label: 'Consoles', icon: LayoutGrid, also: '/console/' },
  // só com o "Jogar no navegador" ligado (chave de API do Drive)
  ...(PLAY_ENABLED ? [{ to: '/jogar', label: 'Jogar', icon: Play }] : []),
  { to: '/franquias', label: 'Franquias', icon: Layers, also: '/franquia/' },
  { to: '/recomps', label: 'Recomps', icon: Monitor },
  { to: '/minha-lista', label: 'Minha lista', tab: 'Lista', icon: Heart },
  { to: '/sortear', label: 'Sortear', icon: Dices },
  { to: '/emuladores', label: 'Emuladores', tab: 'Emular', icon: Gamepad2 },
];

function useNavActive() {
  const { pathname } = useLocation();
  return (n: (typeof NAV)[number]) => pathname === n.to || (n.to !== '/' && pathname.startsWith(n.to + '/')) || (!!n.also && pathname.startsWith(n.also));
}

/** Onde a busca vale agora: dentro de um console, de uma franquia, ou no acervo todo. */
function useSearchScope() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const byId = useLibrary((s) => s.byId);
  const recompsId = useLibrary((s) => s.recompsId);

  let c = '';
  let f = '';
  const inConsole = pathname.match(/^\/console\/([^/]+)/);
  const inFranchise = pathname.match(/^\/franquia\/([^/]+)/);
  if (pathname === '/busca') {
    c = params.get('c') || '';
    f = params.get('f') || '';
  } else if (inConsole) c = decodeURIComponent(inConsole[1]);
  else if (pathname.startsWith('/recomps')) c = recompsId || '';
  else if (inFranchise) f = decodeURIComponent(inFranchise[1]);

  const franchise = f ? FRANCHISES.find((x) => x.id === f) : undefined;
  const one = c && !c.includes(',') ? byId[c] : undefined;
  return {
    c,
    f: franchise ? f : '',
    label: franchise ? franchise.name : one ? (one.id === recompsId ? 'Recomps' : one.name) : '',
    color: franchise ? franchise.color : one?.info.color,
  };
}

/** Campo de busca: digitar leva pra /busca (já restrita ao console ou franquia aberta); apagar volta pra onde você estava. */
function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const scope = useSearchScope();
  const onSearch = location.pathname === '/busca';
  const [q, setQ] = useState(onSearch ? params.get('q') || '' : '');
  const before = useRef('/');
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // saiu da busca por outro caminho (menu, Esc): limpa o campo
  useEffect(() => {
    if (!onSearch) setQ('');
  }, [onSearch]);

  // "/" foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const change = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const text = value.trim();
      if (text) {
        const next = new URLSearchParams({ q: text });
        if (scope.c) next.set('c', scope.c);
        if (scope.f) next.set('f', scope.f);
        if (!onSearch) before.current = location.pathname + location.search;
        navigate('/busca?' + next, { replace: onSearch });
      } else if (onSearch) {
        navigate(before.current, { replace: true });
      }
    }, 160);
  };

  return (
    <label className="group relative ml-auto flex h-10 min-w-0 flex-1 items-center sm:max-w-xs lg:min-w-52 lg:max-w-sm">
      <Search size={17} strokeWidth={2.5} className="pointer-events-none absolute left-3 text-muted transition group-focus-within:text-fg" />
      <input
        ref={input}
        type="search"
        value={q}
        onChange={(e) => change(e.target.value)}
        placeholder={scope.label ? 'Buscar em ' + scope.label : 'Buscar em todo o acervo'}
        aria-label={scope.label ? 'Buscar jogo em ' + scope.label : 'Buscar jogo'}
        autoComplete="off"
        className="size-full rounded-lg bg-white/6 pr-9 pl-9.5 text-sm ring-1 ring-line outline-none transition placeholder:text-muted focus:bg-ink-2 focus:ring-2 focus:ring-tint [&::-webkit-search-cancel-button]:hidden"
      />
      {scope.label ? (
        // bolinha da cor do console/franquia: avisa que a busca está restrita
        <span aria-hidden title={'Buscando só em ' + scope.label} className="pointer-events-none absolute right-3 size-2.5 rounded-full" style={{ background: scope.color }} />
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-line px-1.5 font-mono text-[11px] text-muted group-focus-within:hidden md:block">/</kbd>
      )}
    </label>
  );
}

function TopBar() {
  const isActive = useNavActive();
  const favN = useFavs((s) => Object.keys(s.favs).length);
  const refreshing = useLibrary((s) => s.refreshing);
  const load = useLibrary((s) => s.load);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={'gutter sticky top-0 z-30 flex h-[68px] items-center gap-3 transition duration-300 ' + (scrolled ? 'bg-ink/95 shadow-[0_1px_0_var(--color-line),0_12px_30px_-18px_#000]' : 'bg-linear-to-b from-ink/90 to-ink/40')}>
      <Link to="/" aria-label="Arcádia, início" className="shrink-0">
        <Logo />
      </Link>
      <nav aria-label="Principal" className="ml-2 hidden items-center gap-0.5 lg:flex">
        {NAV.map((n) => {
          const on = isActive(n);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold whitespace-nowrap transition xl:px-3 ' + (on ? 'text-fg' : 'text-muted hover:bg-white/5 hover:text-fg')}
            >
              <n.icon size={17} strokeWidth={2.2} className="hidden xl:block" />
              {n.label}
              {n.to === '/minha-lista' && favN > 0 && <span className="rounded-full bg-heart/20 px-1.5 font-mono text-[11px] text-heart">{favN}</span>}
              {on && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-tint transition-colors duration-500" />}
            </NavLink>
          );
        })}
      </nav>
      <SearchBox />
      {PLAY_ENABLED && (
        <Link
          to="/cache"
          title="Cache e saves"
          aria-label="Cache e saves"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted ring-1 ring-line transition hover:bg-white/5 hover:text-fg"
        >
          <Settings size={17} strokeWidth={2.2} />
        </Link>
      )}
      <button
        onClick={() => load(true)}
        disabled={refreshing}
        title="Recarregar a lista do Drive"
        aria-label="Recarregar a lista do Drive"
        className="grid size-10 shrink-0 place-items-center rounded-lg text-muted ring-1 ring-line transition hover:bg-white/5 hover:text-fg"
      >
        <RefreshCw size={17} strokeWidth={2.3} className={refreshing ? 'animate-spin' : ''} />
      </button>
    </header>
  );
}

/** Navegação de baixo, no celular e tablet. */
function TabBar() {
  const isActive = useNavActive();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {NAV.map((n) => {
        const on = isActive(n);
        return (
          <NavLink key={n.to} to={n.to} className={'flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2.5 text-[10px] font-semibold tracking-tight transition ' + (on ? 'text-fg' : 'text-muted')}>
            <n.icon size={20} strokeWidth={2.2} className={on ? 'text-tint-hi' : ''} />
            <span className="max-w-full truncate">{n.tab || n.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function Toast() {
  const msg = useUi((s) => s.toastMsg);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!msg) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg || !shown) return null;
  return (
    <div key={msg.id} role="status" className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 animate-rise rounded-full bg-fg px-5 py-2.5 text-sm font-bold text-ink shadow-2xl lg:bottom-8">
      {msg.text}
    </div>
  );
}

/** Esc fecha o modal ou sobe um nível. */
function useEscape() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const ui = useUi.getState();
      if (ui.modalKey) return ui.closeGame();
      if (pathname.startsWith('/franquia/')) return navigate('/franquias');
      if (pathname.startsWith('/recomps/')) return navigate('/' + pathname.split('/').filter(Boolean).slice(0, -1).join('/'));
      if (pathname.startsWith('/console/')) {
        const parts = pathname.split('/').filter(Boolean); // ['console', id, ...pastas]
        return navigate(parts.length > 2 ? '/' + parts.slice(0, -1).join('/') : '/consoles');
      }
      if (pathname !== '/') navigate('/');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, pathname]);
}

function ErrorBox({ message }: { message: string | null }) {
  const load = useLibrary((s) => s.load);
  return (
    <div className="gutter py-16">
      <div className="mx-auto max-w-xl rounded-2xl bg-red-500/10 p-6 ring-1 ring-red-500/30">
        <strong className="text-lg">Não consegui ler a pasta do Drive.</strong>
        <p className="mt-2 text-sm leading-relaxed text-fg/80">
          Confira se o Apps Script está publicado e se o <code className="font-mono">ROOT_FOLDER_ID</code> no <code className="font-mono">Code.gs</code> está certo.
        </p>
        {message && <p className="mt-2 font-mono text-xs text-muted">{message}</p>}
        <button onClick={() => load()} className="mt-4 rounded-lg bg-fg px-4 py-2 text-sm font-bold text-ink hover:bg-white">
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const status = useLibrary((s) => s.status);
  const error = useLibrary((s) => s.error);
  const { pathname } = useLocation();
  useEscape();

  // trocou de página: volta pro topo e fecha o modal
  useEffect(() => {
    window.scrollTo(0, 0);
    useUi.getState().closeGame();
  }, [pathname]);

  return (
    <div className="relative min-h-screen">
      {/* brilho da cor do console no topo da página */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(80%_60%_at_20%_0%,color-mix(in_srgb,var(--tint)_22%,transparent),transparent_70%)]" />
      <TopBar />
      <main className="relative pb-28 lg:pb-16">{status === 'error' ? <ErrorBox message={error} /> : <Outlet />}</main>
      <TabBar />
      <GameModal />
      <Toast />
    </div>
  );
}
