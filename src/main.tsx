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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
