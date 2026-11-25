# Arcádia

Meu acervo pessoal de jogos: um catálogo estilo streaming das ROMs guardadas no Google Drive, organizado por console.

- **Início** com destaques, fileiras por console, recém-adicionados e jogos em português
- **Consoles** e subpastas (Jogos, DLC, Updates…)
- **Recomps**: a pasta `RECOMPS` do Drive tem página própria e não aparece entre os consoles
- **Franquias** (Mario, Zelda, Pokémon…) juntando jogos de todos os consoles
- **Minha lista** de favoritos, salva no navegador
- **Sortear**: roleta que escolhe o que jogar
- **Emuladores**: links oficiais, filtrados pelos consoles que existem no acervo
- **Busca** em tudo, capas automáticas (libretro-thumbnails) e sinopse (Wikipédia)

## Tecnologias

[Vite](https://vite.dev) · [React](https://react.dev) + TypeScript · [Tailwind CSS v4](https://tailwindcss.com) · [React Router](https://reactrouter.com) · [Zustand](https://zustand.docs.pmnd.rs) · [Lucide](https://lucide.dev)

## Rodando

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # confere os tipos e gera a pasta dist/
npm run preview  # serve a dist/ pra conferir o build
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
- **Capas**: [libretro-thumbnails](https://github.com/libretro-thumbnails), casadas pelo nome do arquivo e redimensionadas pelo wsrv.nl.
- **Sinopses**: Wikipédia (português; se não achar, inglês).

Favoritos, listas de capas e sinopses ficam em cache no `localStorage`.

## Publicação (GitHub Pages)

O workflow `.github/workflows/deploy.yml` faz o build e publica a cada push na `main`.

Configuração única no repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
