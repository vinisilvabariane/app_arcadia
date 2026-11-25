/** O que o Apps Script devolve. */
export interface ApiConsole {
  id: string;
  name: string;
}
export interface ApiFile {
  id: string;
  file: string;
  size?: number;
  updated: number;
  folder?: boolean;
  path?: string[];
}

export interface ConsoleInfo {
  /** sigla curta: "SNES", "PS2" */
  short: string;
  color: string;
  /** nome do sistema no libretro-thumbnails; null = sem capas */
  sys: string | null;
}

export interface Game {
  id: string;
  key: string;
  file: string;
  size: number;
  updated: number;
  folder: boolean;
  /** subpastas dentro do console */
  path: string[];
  /** nome do arquivo sem extensão */
  base: string;
  ext: string;
  title: string;
  tags: string[];
  consoleId: string;
  consoleName: string;
  short: string;
  color: string;
  sys: string | null;
  pt: boolean;
  searchKey: string;
}

export interface GameConsole {
  id: string;
  name: string;
  info: ConsoleInfo;
  ptbr: boolean;
  /** null enquanto a lista ainda não chegou do Drive */
  games: Game[] | null;
}

export interface Emulator {
  name: string;
  url: string;
  for: string;
  color: string;
  wide?: boolean;
  desc: string;
  covers: string[];
  os: string;
}

export interface Franchise {
  id: string;
  name: string;
  color: string;
  re: RegExp;
}

export type SortKey = 'az' | 'recent' | 'size';
