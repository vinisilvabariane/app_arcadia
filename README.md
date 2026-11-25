# Arcádia

Meu acervo pessoal de jogos: um catálogo estilo streaming das ROMs guardadas no Google Drive, organizado por console.

- **Início** com destaques, fileiras por console, recém-adicionados e jogos em português
- **Consoles** e subpastas (Jogos, DLC, Updates…)
- **Recomps**: a pasta `RECOMPS` do Drive tem página própria e não aparece entre os consoles
- **Franquias** (Mario, Zelda, Pokémon…) juntando jogos de todos os consoles
- **Minha lista** de favoritos, salva no navegador
- **Sortear**: roleta que escolhe o que jogar
- **Emuladores**: links oficiais, filtrados pelos consoles que existem no acervo
- **Busca** que respeita onde você está (dentro de um console ou franquia, procura só ali), capas automáticas (libretro-thumbnails) e sinopse (Wikipédia)

## Tecnologias

[Vite](https://vite.dev) · [React](https://react.dev) + TypeScript · [Tailwind CSS v4](https://tailwindcss.com) · [React Router](https://reactrouter.com) · [Zustand](https://zustand.docs.pmnd.rs) · [Lucide](https://lucide.dev)

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # confere os tipos e gera a pasta dist/
npm run preview  # serve a dist/ pra conferir o build
npm run covers   # (opcional) baixa as listas de capas pra public/covers/
```

Para mexer no visual sem depender do Drive, crie um `.env.local` com `VITE_USE_MOCK=1` (veja `.env.example`).

## Pastas

```
src/
├─ main.tsx, App.tsx     entrada e rotas
├─ index.css             tema do Tailwind (cores, fontes, animações)
├─ types.ts              tipos compartilhados
├─ data/                 listas fixas: consoles, emuladores, franquias, dados de exemplo
├─ lib/                  lógica sem tela: API do Drive, capas, sinopse, formatação
├─ store/                estado global (Zustand): acervo, favoritos, interface
├─ components/           peças reutilizáveis: card, capa, fileira, modal, layout…
└─ pages/                uma tela por arquivo
```

Onde mexer nas coisas mais comuns:

| Quero…                                   | Arquivo                  |
| ---------------------------------------- | ------------------------ |
| cadastrar um console (cor, sigla, capas) | `src/data/consoles.ts`   |
| adicionar um emulador                    | `src/data/emulators.ts`  |
| adicionar uma franquia                   | `src/data/franchises.ts` |
| trocar cores e fontes                    | `src/index.css`          |
| trocar a URL do Apps Script              | `src/lib/api.ts`         |

## De onde vêm os dados

- **Jogos**: um Web App do Google Apps Script lista as pastas do Drive (`getConsoles`, `getGames`, `clearCache`). Cada pasta da raiz é um console.
- **Capas**: [libretro-thumbnails](https://github.com/libretro-thumbnails), casadas pelo nome do arquivo e redimensionadas pelo wsrv.nl. A lista de nomes de cada console é gerada no deploy (`scripts/fetch-covers.mjs` → `covers/*.json`), porque a API do GitHub só aceita 60 chamadas por hora por IP direto do navegador.
- **Sinopses**: Wikipédia (português; se não achar, inglês).

### Jogar no navegador

Jogos de NES, SNES, Game Boy/Color/Advance, Mega Drive, Master System, Game Gear, DS, PC Engine e Atari 2600 ganham o botão **Jogar** (N64 e PS1 como experimentais). A ROM é buscada direto da API do Drive, guardada no navegador e rodada no [EmulatorJS](https://emulatorjs.org) dentro de um iframe (`public/player.html`).

O recurso fica **desligado até existir uma chave de API**:

1. No [Google Cloud](https://console.cloud.google.com), crie um projeto e ative a **Google Drive API**.
2. Em Credenciais, crie uma **chave de API**. Restrinja a chave à Drive API e aos sites `https://SEU-USUARIO.github.io/*` e `http://localhost:5173/*`.
3. Coloque a chave em `DEFAULT_DRIVE_API_KEY` (`src/data/play.ts`). Ela é pública por natureza: a proteção são as restrições do passo 2.

Detalhes:

- **Onde mexer:** `src/data/play.ts` tem a tabela console → núcleo (`PLAY_CORES`), a versão do EmulatorJS e os limites do cache.
- **Cache de ROMs:** limite de 1 GB (ajustável na tela *Cache e saves*). Quando enche, saem as jogadas há mais tempo.
- **Saves:** save de bateria e save state ficam num banco separado, pela identificação do arquivo no Drive, e nunca são apagados pela limpeza do cache. Dá pra exportar e importar em `.json`.
- **Sem threads:** o GitHub Pages não envia os cabeçalhos COOP/COEP, então núcleos que exigem threads (PSP, DOS) ficam de fora e N64/PS1 podem pesar.
- **Uso pessoal:** só funciona com arquivos compartilhados como "qualquer pessoa com o link". Não divulgue o endereço do site.
- **Testar sem chave:** `VITE_PLAY_DEV_ROM=_poc/arquivo.zip` no `.env.local` faz o `npm run dev` usar um arquivo de `public/_poc/` no lugar do Drive.

### O que fica guardado no navegador

Na primeira visita o site baixa tudo e guarda; nas seguintes abre do que está guardado.

| O quê | Onde | Quando atualiza |
| --- | --- | --- |
| Acervo (lista de jogos do Drive) | IndexedDB | Se a cópia tem mais de 12 h, ou pelo botão de recarregar |
| Qual capa casou com cada jogo | `localStorage` | Quando entra jogo novo ou a lista de capas muda (`covers/manifest.json`) |
| Imagens das capas, JS/CSS, fontes | Cache do service worker (`public/sw.js`) | Capas e fontes nunca; JS/CSS a cada versão publicada |
| Favoritos e sinopses | `localStorage` | — |

O service worker só é registrado na versão publicada (`npm run build`), não no `npm run dev`. Para testar o cache localmente: `npm run build && npm run preview`.

## Publicação (GitHub Pages)

O workflow `.github/workflows/deploy.yml` faz o build e publica a cada push na `main`.

Configuração única no repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
