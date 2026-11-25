import { useEffect } from 'react';
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
import { useLibrary } from './store/library';

/* HashRouter (#/consoles): no GitHub Pages não existe servidor pra reescrever rotas,
   então o caminho fica depois do "#" e recarregar a página nunca dá 404. */
export function App() {
  useEffect(() => {
    useLibrary.getState().load();
  }, []);

  return (
    <HashRouter>
      <Routes>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
