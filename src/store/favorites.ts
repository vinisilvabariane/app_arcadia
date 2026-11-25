import { create } from 'zustand';
import { storage } from '../lib/format';
import { useUi } from './ui';

/* Favoritos ("Minha lista"), guardados no navegador.
   Mesmo formato e chave da versão antiga do site, pra ninguém perder a lista. */
const KEY = 'arc-favoritos-v1';
type Saved = { k: string; t: number }[];

interface FavState {
  /** chave do jogo -> quando foi adicionado */
  favs: Record<string, number>;
  toggle: (key: string) => void;
}

export const useFavs = create<FavState>((set, get) => ({
  favs: Object.fromEntries(storage.get<Saved>(KEY, []).map((f) => [f.k, f.t])),
  toggle(key) {
    const favs = { ...get().favs };
    const on = !favs[key];
    if (on) favs[key] = Date.now();
    else delete favs[key];
    set({ favs });
    storage.set(KEY, Object.entries(favs).map(([k, t]) => ({ k, t })));
    useUi.getState().toast(on ? 'Adicionado à Minha lista' : 'Removido da Minha lista');
  },
}));
