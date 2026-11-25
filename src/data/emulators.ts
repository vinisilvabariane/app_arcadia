import type { Emulator } from '../types';

/* Emuladores (links oficiais). "covers" usa as siglas de data/consoles.ts. */
export const EMULATORS: Emulator[] = [
  { name: 'RetroArch', url: 'https://www.retroarch.com', for: 'Vários consoles num app só', color: '#e8a33d', wide: true,
    desc: 'Junta dezenas de emuladores (os “núcleos”) numa interface única, com a mesma configuração de controle pra tudo. Ideal pros consoles antigos: escolha o núcleo do console dentro do próprio app.',
    covers: ['NES','SNES','N64','GB','GBC','GBA','DS','MD','SMS','GG','SCD','SAT','DC','PS1','PSP','2600','5200','7800','NEO','ARC','MAME','NGP','PCE','MSX'], os: 'Windows · macOS · Linux · Android · iOS' },
  { name: 'Cemu', url: 'https://cemu.info', for: 'Wii U', color: '#0096c8',
    desc: 'O emulador de Wii U. Roda muito bem os principais jogos do console.', covers: ['Wii U'], os: 'Windows · macOS · Linux' },
  { name: 'shadPS4', url: 'https://shadps4.net', for: 'PlayStation 4', color: '#1d3f9a',
    desc: 'Emulador experimental de PS4. Ainda poucos jogos rodam bem; confira a lista de compatibilidade antes.', covers: ['PS4'], os: 'Windows · macOS · Linux' },
  { name: 'MAME', url: 'https://www.mamedev.org', for: 'Fliperama (arcade)', color: '#5a6b7d',
    desc: 'O emulador de fliperama de referência. As ROMs precisam ser da mesma versão do MAME que você usa.', covers: ['MAME','ARC','NEO'], os: 'Windows · macOS · Linux' },
  { name: 'Dolphin', url: 'https://dolphin-emu.org', for: 'GameCube e Wii', color: '#2ba8e0',
    desc: 'O emulador de GameCube e Wii. Roda em alta resolução e aceita o controle do Wii.', covers: ['GC','Wii'], os: 'Windows · macOS · Linux · Android' },
  { name: 'PCSX2', url: 'https://pcsx2.net', for: 'PlayStation 2', color: '#2f55c4',
    desc: 'O emulador de PS2 mais completo. Precisa da BIOS do console.', covers: ['PS2'], os: 'Windows · macOS · Linux' },
  { name: 'DuckStation', url: 'https://github.com/stenzek/duckstation', for: 'PlayStation', color: '#8a94a8',
    desc: 'Emulador de PS1 rápido e preciso, com melhorias de imagem. Precisa da BIOS do console.', covers: ['PS1'], os: 'Windows · macOS · Linux · Android' },
  { name: 'PPSSPP', url: 'https://www.ppsspp.org', for: 'PSP', color: '#3e4c6e',
    desc: 'Emulador de PSP leve, roda bem até em celular simples.', covers: ['PSP'], os: 'Windows · macOS · Linux · Android · iOS' },
  { name: 'RPCS3', url: 'https://rpcs3.net', for: 'PlayStation 3', color: '#4c5a73',
    desc: 'Emulador de PS3. Pede um PC forte; confira a lista de compatibilidade no site antes.', covers: ['PS3'], os: 'Windows · macOS · Linux' },
  { name: 'Vita3K', url: 'https://vita3k.org', for: 'PS Vita', color: '#1f6fe0',
    desc: 'Emulador experimental de PS Vita. Muitos jogos já rodam; veja a lista no site.', covers: ['Vita'], os: 'Windows · macOS · Linux · Android' },
  { name: 'melonDS', url: 'https://melonds.kuribo64.net', for: 'Nintendo DS', color: '#7d8796',
    desc: 'Emulador de DS preciso, com as duas telas lado a lado ou empilhadas.', covers: ['DS'], os: 'Windows · macOS · Linux' },
  { name: 'Azahar', url: 'https://azahar-emu.org', for: 'Nintendo 3DS', color: '#d02a3c',
    desc: 'Continuação dos projetos Citra e Lime3DS para jogos de 3DS.', covers: ['3DS'], os: 'Windows · macOS · Linux · Android' },
  { name: 'mGBA', url: 'https://mgba.io', for: 'Game Boy, Color e Advance', color: '#4b3bbf',
    desc: 'Emulador de GBA leve e preciso. Também roda Game Boy e Game Boy Color.', covers: ['GBA','GB','GBC'], os: 'Windows · macOS · Linux' },
  { name: 'RMG', url: 'https://github.com/Rosalie241/RMG', for: 'Nintendo 64', color: '#1f9d55',
    desc: 'Rosalie’s Mupen GUI: emulador de N64 moderno e fácil de configurar.', covers: ['N64'], os: 'Windows · Linux' },
  { name: 'Snes9x', url: 'https://www.snes9x.com', for: 'Super Nintendo', color: '#6b4fd8',
    desc: 'O clássico emulador de SNES: leve e compatível com quase tudo.', covers: ['SNES'], os: 'Windows · macOS · Linux' },
  { name: 'Mesen', url: 'https://www.mesen.ca', for: 'NES, SNES e Game Boy', color: '#c62d2d',
    desc: 'Muito preciso e cheio de ferramentas. Uma das melhores opções pra NES.', covers: ['NES','SNES','GB','GBC','PCE'], os: 'Windows · macOS · Linux' },
  { name: 'Flycast', url: 'https://github.com/flyinghead/flycast', for: 'Dreamcast', color: '#f07a1a',
    desc: 'Emulador de Dreamcast com imagem em alta resolução.', covers: ['DC'], os: 'Windows · macOS · Linux · Android' },
  { name: 'ares', url: 'https://ares-emu.net', for: 'Vários consoles, com precisão', color: '#9a6bd8',
    desc: 'Multi-sistema focado em precisão: NES, SNES, N64, Mega Drive, PC Engine e outros.', covers: ['NES','SNES','N64','GB','GBC','GBA','MD','SMS','GG','SCD','PCE','NGP','MSX'], os: 'Windows · macOS · Linux' },
  { name: 'Stella', url: 'https://stella-emu.github.io', for: 'Atari 2600', color: '#b8692e',
    desc: 'O emulador de referência para Atari 2600.', covers: ['2600'], os: 'Windows · macOS · Linux' }
];

/** Emuladores que rodam um console: específicos primeiro, depois os multi-sistema. */
export function emusFor(short: string): Emulator[] {
  return EMULATORS.filter((e) => e.covers.includes(short)).sort(
    (a, b) => Number(a.covers.length > 5) - Number(b.covers.length > 5),
  );
}
