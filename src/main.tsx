import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

/* Service worker (public/sw.js): guarda o site e as capas no navegador.
   Só na versão publicada: no modo dev ele atrapalharia a atualização ao vivo do Vite. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch((err) => console.warn('service worker', err));
    // pede pro navegador não apagar o que foi guardado quando o disco apertar
    navigator.storage?.persist?.().catch(() => {});
  });

  /* Versão nova publicada? O app instalado fica aberto em segundo plano e não recarrega sozinho.
     Ao voltar pra ele (e a cada 30 min), confere o index.html: se o JS principal mudou, recarrega.
     Nunca no meio de um jogo (/jogar). */
  const current = (document.querySelector('script[type="module"][src*="/assets/"]') as HTMLScriptElement | null)?.src.split('/assets/')[1];
  let lastCheck = 0;
  const checkUpdate = async () => {
    if (!current || Date.now() - lastCheck < 60e3 || location.hash.startsWith('#/jogar/')) return;
    lastCheck = Date.now();
    try {
      const html = await (await fetch(import.meta.env.BASE_URL + 'index.html', { cache: 'no-store' })).text();
      if (html.includes('/assets/index-') && !html.includes(current)) location.reload();
    } catch {
      /* sem rede: tenta na próxima */
    }
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkUpdate());
  setInterval(checkUpdate, 30 * 60e3);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
