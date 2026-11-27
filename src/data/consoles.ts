import type { ConsoleInfo } from '../types';
import { hash, norm } from '../lib/format';

/* Consoles conhecidos: cor, sigla e nome do sistema no libretro (para as capas).
   A chave é o nome da pasta "normalizado": minúsculas, só letras e números,
   sem o que estiver entre parênteses. */
interface KnownConsole extends ConsoleInfo { keys: string[] }

export const CONSOLES: KnownConsole[] = [
  { keys: ['supernintendo','snes','superfamicom','sfc','supernes'], short: 'SNES', color: '#6b4fd8', sys: 'Nintendo - Super Nintendo Entertainment System' },
  { keys: ['nintendofamicom','nes','famicom','nintendinho','nintendo'], short: 'NES', color: '#c62d2d', sys: 'Nintendo - Nintendo Entertainment System' },
  { keys: ['nintendo64','n64'], short: 'N64', color: '#1f9d55', sys: 'Nintendo - Nintendo 64' },
  { keys: ['gameboyadvance','gba'], short: 'GBA', color: '#4b3bbf', sys: 'Nintendo - Game Boy Advance' },
  { keys: ['gameboycolor','gbc'], short: 'GBC', color: '#b8326b', sys: 'Nintendo - Game Boy Color' },
  { keys: ['gameboy','gb'], short: 'GB', color: '#7a9a1a', sys: 'Nintendo - Game Boy' },
  { keys: ['nintendods','nds','ds'], short: 'DS', color: '#7d8796', sys: 'Nintendo - Nintendo DS' },
  { keys: ['nintendo3ds','3ds'], short: '3DS', color: '#d02a3c', sys: 'Nintendo - Nintendo 3DS' },
  { keys: ['nintendogamecube','gamecube','gc','ngc'], short: 'GC', color: '#5b47b0', sys: 'Nintendo - GameCube' },
  { keys: ['nintendowii','wii'], short: 'Wii', color: '#2ba8e0', sys: 'Nintendo - Wii' },
  { keys: ['switch2','nintendoswitch2'], short: 'NS2', color: '#e4002b', sys: null },
  { keys: ['switch','nintendoswitch'], short: 'Switch', color: '#e60012', sys: null },
  { keys: ['megadrive','genesis','segagenesis','md'], short: 'MD', color: '#d7261e', sys: 'Sega - Mega Drive - Genesis' },
  { keys: ['mastersystem','sms'], short: 'SMS', color: '#b5121b', sys: 'Sega - Master System - Mark III' },
  { keys: ['gamegear','gg'], short: 'GG', color: '#3a3f4b', sys: 'Sega - Game Gear' },
  { keys: ['segacd','megacd'], short: 'SCD', color: '#3e4c9a', sys: 'Sega - Mega-CD - Sega CD' },
  { keys: ['saturn','segasaturn'], short: 'SAT', color: '#4a5a8a', sys: 'Sega - Saturn' },
  { keys: ['dreamcast','dc'], short: 'DC', color: '#f07a1a', sys: 'Sega - Dreamcast' },
  { keys: ['ps1','psx','playstation','playstation1','psone'], short: 'PS1', color: '#8a94a8', sys: 'Sony - PlayStation' },
  { keys: ['ps2','playstation2'], short: 'PS2', color: '#2f55c4', sys: 'Sony - PlayStation 2' },
  { keys: ['ps3','playstation3'], short: 'PS3', color: '#4c5a73', sys: 'Sony - PlayStation 3' },
  { keys: ['psp','playstationportable'], short: 'PSP', color: '#3e4c6e', sys: 'Sony - PlayStation Portable' },
  { keys: ['psvita','vita'], short: 'Vita', color: '#1f6fe0', sys: 'Sony - PlayStation Vita' },
  { keys: ['atari2600','atari','2600'], short: '2600', color: '#b8692e', sys: 'Atari - 2600' },
  { keys: ['atari5200','5200'], short: '5200', color: '#9e5a2a', sys: 'Atari - 5200' },
  { keys: ['atari7800','7800'], short: '7800', color: '#a8502a', sys: 'Atari - 7800' },
  { keys: ['neogeo'], short: 'NEO', color: '#c9a227', sys: 'FBNeo - Arcade Games' },
  { keys: ['arcade','fba','fbneo','cps1','cps2','cps3'], short: 'ARC', color: '#d9862b', sys: 'FBNeo - Arcade Games' },
  { keys: ['mame'], short: 'MAME', color: '#5a6b7d', sys: 'MAME' },
  { keys: ['ps4','playstation4'], short: 'PS4', color: '#1d3f9a', sys: 'Sony - PlayStation 4' },
  { keys: ['ps5','playstation5'], short: 'PS5', color: '#5b6c8f', sys: null },
  { keys: ['nintendowiiu','wiiu'], short: 'Wii U', color: '#0096c8', sys: 'Nintendo - Wii U' },
  { keys: ['xbox'], short: 'XBOX', color: '#107c10', sys: 'Microsoft - Xbox' },
  { keys: ['xbox360'], short: 'X360', color: '#4c9a2a', sys: 'Microsoft - Xbox 360' },
  { keys: ['neogeopocketcolor','ngpc','neogeopocket'], short: 'NGP', color: '#2f7f8f', sys: 'SNK - Neo Geo Pocket Color' },
  { keys: ['pcengine','pce','turbografx','turbografx16','tg16'], short: 'PCE', color: '#c2453b', sys: 'NEC - PC Engine - TurboGrafx 16' },
  { keys: ['msx'], short: 'MSX', color: '#3f6fb5', sys: 'Microsoft - MSX' }
];

export const HOME_TINT = '#e8a33d';

export function isPtBr(s: string): boolean {
  return /pt[\s_-]?br|brazil|brasil|portugu|traduz/i.test(s);
}

export function consoleInfo(folderName: string): ConsoleInfo {
  // ignora o que está entre parênteses e marcas de tradução ("PT-BR", "PTBR")
  const clean = folderName.replace(/\([^)]*\)/g, ' ').replace(/\bpt[\s_-]?br\b/gi, ' ').trim();
  const base = norm(clean);
  const known = CONSOLES.find((c) => c.keys.includes(base));
  if (known) return { short: known.short, color: known.color, sys: known.sys };
  // sem cadastro: uma palavra vira até 5 letras ("PS4"); várias viram iniciais ("Neo Geo CD" -> "NGC")
  const words = clean.split(/\s+/).filter(Boolean);
  const short = words.length === 1 ? words[0].slice(0, 5) : words.map((w) => (/\d/.test(w) ? w : w[0])).join('').slice(0, 5);
  return { short: (short || '?').toUpperCase(), color: `hsl(${hash(folderName) % 360} 55% 45%)`, sys: null };
}
