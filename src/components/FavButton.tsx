import { Heart } from 'lucide-react';
import { useFavs } from '../store/favorites';
import type { Game } from '../types';
import { btnSoft } from './ui';

/** Coração de "Minha lista". variant "icon" = bolinha sobre a capa; "button" = botão com texto. */
export function FavButton({ game, variant = 'icon' }: { game: Game; variant?: 'icon' | 'button' }) {
  const on = useFavs((s) => !!s.favs[game.key]);
  const toggle = useFavs((s) => s.toggle);
  const label = on ? 'Tirar da minha lista' : 'Pôr na minha lista';
  const heart = <Heart key={String(on)} size={18} strokeWidth={2.3} className={on ? 'animate-pop fill-heart text-heart' : ''} />;

  if (variant === 'button') {
    return (
      <button className={btnSoft} aria-pressed={on} onClick={() => toggle(game.key)}>
        {heart}
        {on ? 'Na minha lista' : 'Minha lista'}
      </button>
    );
  }
  return (
    <button
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={() => toggle(game.key)}
      className="grid size-9 place-items-center rounded-full bg-black/70 text-white transition hover:scale-110 hover:bg-black/85"
    >
      {heart}
    </button>
  );
}
