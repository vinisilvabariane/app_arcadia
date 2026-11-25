import { useEffect } from 'react';

/** Pinta o site (brilho do topo, sublinhados, foco) com a cor do console/página atual. */
export function useTint(color: string): void {
  useEffect(() => {
    document.documentElement.style.setProperty('--tint', color);
  }, [color]);
}
