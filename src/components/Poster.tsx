import { useEffect, useState } from 'react';
import { coverUrls } from '../lib/covers';
import { hash } from '../lib/format';
import { useLibrary } from '../store/library';
import type { Game } from '../types';
import { PtFlag } from './ui';

/* Largura pedida ao redimensionador = largura do card na tela x densidade da tela.
   Imagem no tamanho exato baixa mais rápido e o navegador não gasta tempo reduzindo. */
const DPR = Math.min(2, Math.ceil(window.devicePixelRatio || 1));
export const CARD_IMG_W = 176 * DPR;
export const THUMB_IMG_W = 96 * DPR;

interface Props {
  game: Game;
  /** largura da imagem pedida ao redimensionador */
  w?: number;
  /** mostra a extensão do arquivo no canto */
  badge?: boolean;
  className?: string;
}

/** Capa do jogo. Sem capa: gradiente na cor do console com o título escrito. */
export function Poster({ game: g, w = CARD_IMG_W, badge, className = '' }: Props) {
  useLibrary((s) => s.coverTick); // redesenha quando a lista de capas chega
  const urls = coverUrls(g, w);
  const [tryIdx, setTryIdx] = useState(0);
  const first = urls[0];
  useEffect(() => setTryIdx(0), [first]);

  const h = hash(g.title);
  const shade = `hsl(${h % 360} 60% ${30 + (h % 25)}%)`;
  const src = urls[tryIdx];

  return (
    <div className={'relative aspect-[3/4] overflow-hidden rounded-lg bg-ink-3 ' + className}>
      <div
        className="absolute inset-0 flex flex-col justify-end gap-1 p-3 text-left"
        style={{ background: `linear-gradient(165deg, color-mix(in srgb, ${g.color} 72%, ${shade}) 0%, color-mix(in srgb, ${g.color} 26%, #0b0c12) 100%)` }}
      >
        <small className="font-mono text-[10px] font-medium tracking-widest text-white/70 uppercase">{g.short}</small>
        <span className="line-clamp-4 font-display text-[15px] leading-[1.05] font-extrabold text-white [font-variation-settings:'wdth'_80]">{g.title}</span>
      </div>
      {src && (
        // crossOrigin: sem ele o service worker não consegue guardar a capa (resposta "opaca")
        <img key={src} src={src} alt="" crossOrigin="anonymous" loading="lazy" decoding="async" onError={() => setTryIdx((i) => i + 1)} className="absolute inset-0 size-full object-cover" />
      )}
      {badge && g.ext && <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white uppercase">{g.ext}</span>}
      {g.pt && <PtFlag className="absolute top-2 left-2" />}
    </div>
  );
}

/** Capa minúscula e borrada, pra servir de fundo. */
export function useBlurBg(g: Game | undefined): string | undefined {
  useLibrary((s) => s.coverTick);
  return g ? coverUrls(g, 0, true)[0] : undefined;
}
