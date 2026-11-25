/* "Jogar no navegador": o que pode rodar e com qual núcleo do EmulatorJS.

   Uso pessoal: o método só funciona com arquivos do Drive compartilhados como
   "qualquer pessoa com o link". Não divulgue o endereço do site. */

/** Chave de API do Google, restrita no Google Cloud a "Drive API" e ao endereço do site.
    Ela é pública por natureza (vai junto com o site); a proteção são essas restrições.
    Vazia = recurso desligado: o botão Jogar não aparece e o resto do site segue igual. */
const DEFAULT_DRIVE_API_KEY = '';
export const DRIVE_API_KEY: string = import.meta.env.VITE_DRIVE_API_KEY || DEFAULT_DRIVE_API_KEY;

/** Só no `npm run dev`: usa este arquivo local no lugar do Drive, pra testar sem chave.
    Ex.: VITE_PLAY_DEV_ROM=_poc/snes.zip no .env.local. Não existe na versão publicada. */
export const DEV_ROM_URL: string = import.meta.env.DEV ? import.meta.env.VITE_PLAY_DEV_ROM || '' : '';

/** EmulatorJS numa versão fixa (não "stable"): o site usa um evento interno dele
    (saveSaveFiles) que pode mudar entre versões. Pra atualizar, troque o número e teste os saves. */
export const EJS_DATA = 'https://cdn.emulatorjs.org/4.2.3/data/';

export interface PlayCore {
  /** nome do sistema no EmulatorJS (EJS_core) */
  core: string;
  /** roda, mas pode ficar pesado ou ter falhas */
  experimental?: boolean;
  /** BIOS opcional (URL). Sem ela o núcleo usa a emulação embutida. */
  bios?: string;
}

/** sigla do console (ConsoleInfo.short) -> núcleo. O que não está aqui não ganha botão Jogar. */
export const PLAY_CORES: Record<string, PlayCore> = {
  NES: { core: 'nes' },
  SNES: { core: 'snes' },
  GB: { core: 'gb' },
  GBC: { core: 'gb' },
  GBA: { core: 'gba' },
  MD: { core: 'segaMD' },
  SMS: { core: 'segaMS' },
  GG: { core: 'segaGG' },
  DS: { core: 'nds' },
  PCE: { core: 'pce' },
  '2600': { core: 'atari2600' },
  N64: { core: 'n64', experimental: true },
  PS1: { core: 'psx', experimental: true },
};

const MB = 1024 * 1024;
/** Limite padrão do cache de ROMs. */
export const ROM_CACHE_LIMIT = 1024 * MB;
/** Opções de limite que o usuário pode escolher. */
export const ROM_CACHE_LIMITS: [number, string][] = [
  [256 * MB, '256 MB'],
  [512 * MB, '512 MB'],
  [1024 * MB, '1 GB'],
  [2048 * MB, '2 GB'],
  [4096 * MB, '4 GB'],
];
