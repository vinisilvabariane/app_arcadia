import { create } from 'zustand';
import type { SortKey } from '../types';

interface UiState {
  /** jogo aberto no modal de detalhes */
  modalKey: string | null;
  openGame: (key: string) => void;
  closeGame: () => void;

  sort: SortKey;
  setSort: (s: SortKey) => void;

  toastMsg: { text: string; id: number } | null;
  toast: (text: string) => void;
}

export const useUi = create<UiState>((set) => ({
  modalKey: null,
  openGame: (key) => set({ modalKey: key }),
  closeGame: () => set({ modalKey: null }),

  sort: 'az',
  setSort: (sort) => set({ sort }),

  toastMsg: null,
  toast: (text) => set({ toastMsg: { text, id: Date.now() } }),
}));
