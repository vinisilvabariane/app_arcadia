import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { playCore, playPath } from '../lib/play';
import { useUi } from '../store/ui';
import type { Game } from '../types';
import { btnGo } from './ui';

/** Botão "Jogar" (abre a tela do emulador). Some sozinho quando o jogo não roda no navegador:
    console sem núcleo, pasta, DLC, ou recurso desligado (sem chave de API). */
export function PlayButton({ game, className = '' }: { game: Game; className?: string }) {
  const closeGame = useUi((s) => s.closeGame);
  const core = playCore(game);
  if (!core) return null;
  return (
    <Link to={playPath(game)} onClick={closeGame} className={btnGo + ' ' + className} aria-label={'Jogar ' + game.title + ' no navegador' + (core.experimental ? ' (experimental)' : '')}>
      <Play size={17} strokeWidth={2.6} fill="currentColor" />
      Jogar
      {core.experimental && <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">Experimental</span>}
    </Link>
  );
}
