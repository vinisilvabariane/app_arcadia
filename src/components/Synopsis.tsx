import { ArrowUpRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getSynopsis, wikiSearchUrl, type Synopsis as Syn } from '../lib/synopsis';
import type { Game } from '../types';

type State = { status: 'loading' } | { status: 'done'; data: Syn | null } | { status: 'failed' };

const link = 'inline-flex items-center gap-0.5 font-semibold text-fg/80 underline-offset-2 hover:text-fg hover:underline';

/** Resumo do jogo vindo da Wikipédia, com "Ler mais" quando o texto é comprido. */
export function Synopsis({ game }: { game: Game }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const para = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    setOpen(false);
    getSynopsis(game).then(
      (data) => alive && setState({ status: 'done', data }),
      () => alive && setState({ status: 'failed' }),
    );
    return () => {
      alive = false;
    };
  }, [game]);

  useLayoutEffect(() => {
    const p = para.current;
    if (p && !open) setClamped(p.scrollHeight > p.clientHeight + 2);
  }, [state, open]);

  if (state.status === 'loading') {
    return (
      <div aria-label="Buscando sinopse" className="space-y-2">
        <div className="h-3.5 animate-pulse rounded bg-ink-3" />
        <div className="h-3.5 animate-pulse rounded bg-ink-3" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink-3" />
      </div>
    );
  }

  const data = state.status === 'done' ? state.data : null;
  if (!data) {
    return (
      <p className="text-sm text-muted">
        {state.status === 'failed' ? 'Não deu pra buscar a sinopse agora.' : 'Sem sinopse na Wikipédia pra esse jogo.'}{' '}
        <a href={wikiSearchUrl(game)} target="_blank" rel="noopener" className={link}>
          Procurar na Wikipédia
          <ArrowUpRight size={15} strokeWidth={2.6} />
        </a>
      </p>
    );
  }

  return (
    <div aria-live="polite">
      <p ref={para} className={'text-[15px] leading-relaxed text-fg/85 ' + (open ? '' : 'line-clamp-4')}>
        {data.text}
      </p>
      <div className="mt-2 flex items-center gap-4 text-[13px] text-muted">
        {(clamped || open) && (
          <button className="font-bold text-fg hover:underline" onClick={() => setOpen(!open)}>
            {open ? 'Ler menos' : 'Ler mais'}
          </button>
        )}
        <a href={data.url} target="_blank" rel="noopener" className={link}>
          {data.lang === 'en' ? 'Wikipédia, em inglês' : 'Wikipédia'}
          <ArrowUpRight size={15} strokeWidth={2.6} />
        </a>
      </div>
    </div>
  );
}
