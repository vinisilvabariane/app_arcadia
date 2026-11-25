import { useEffect, useState } from 'react';
import type { Game } from '../types';
import { GameCard } from './GameCard';

const PAGE = 120;

/** Grade de jogos com "Mostrar mais" (120 por vez, pra não pesar com milhares de ROMs). */
export function GameGrid({ games, resetKey }: { games: Game[]; resetKey?: string }) {
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [resetKey]);

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-3.5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
        {games.slice(0, limit).map((g) => (
          <GameCard key={g.key} game={g} />
        ))}
      </div>
      {games.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="mx-auto mt-8 block rounded-lg bg-ink-2 px-6 py-3 text-sm font-bold ring-1 ring-line transition hover:bg-ink-3"
        >
          Mostrar mais {Math.min(PAGE, games.length - limit)}
        </button>
      )}
    </>
  );
}
