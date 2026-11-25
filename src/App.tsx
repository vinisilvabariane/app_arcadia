import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ConsolePage } from './pages/Console';
import { Consoles } from './pages/Consoles';
import { Emulators } from './pages/Emulators';
import { FranchisePage, Franchises } from './pages/Franchises';
import { Home } from './pages/Home';
import { MyList } from './pages/MyList';
import { Raffle } from './pages/Raffle';
import { SearchPage } from './pages/Search';
import { PLAY_ENABLED } from './lib/play';
import { cleanRoms } from './lib/playdb';
import { useLibrary } from './store/library';

// As telas do "Jogar" só são baixadas quando alguém abre uma delas: não pesam na abertura do site.
const PlayPage = lazy(() => import('./pages/Play').then((m) => ({ default: m.PlayPage })));
const PlayHub = lazy(() => import('./pages/PlayHub').then((m) => ({ default: m.PlayHub })));
const CachePage = lazy(() => import('./pages/Cache').then((m) => ({ default: m.CachePage })));

/* HashRouter (#/consoles): no GitHub Pages não existe servidor pra reescrever rotas,
   então o caminho fica depois do "#" e recarregar a página nunca dá 404. */
export function App() {
  useEffect(() => {
    useLibrary.getState().load();
    // limpeza leve do cache de ROMs, sem atrapalhar a abertura do site
    if (PLAY_ENABLED) setTimeout(cleanRoms, 5000);
  }, []);

  return (
    <HashRouter>
      <Routes>
        {/* tela cheia, fora do Layout: sem busca nem atalhos que roubem as teclas do jogo */}
        <Route
          path="jogar/:key"
          element={
            <Suspense fallback={null}>
              <PlayPage />
            </Suspense>
          }
        />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="consoles" element={<Consoles />} />
          <Route path="console/:id/*" element={<ConsolePage />} />
          <Route path="recomps/*" element={<ConsolePage recomps />} />
          <Route path="franquias" element={<Franchises />} />
          <Route path="franquia/:id" element={<FranchisePage />} />
          <Route path="minha-lista" element={<MyList />} />
          <Route path="sortear" element={<Raffle />} />
          <Route path="emuladores" element={<Emulators />} />
          <Route path="busca" element={<SearchPage />} />
          <Route
            path="jogar"
            element={
              <Suspense fallback={null}>
                <PlayHub />
              </Suspense>
            }
          />
          <Route
            path="cache"
            element={
              <Suspense fallback={null}>
                <CachePage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
