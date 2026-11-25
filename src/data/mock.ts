import type { ApiConsole, ApiFile } from '../types';
import { hash } from '../lib/format';

/* Dados de exemplo: usados com VITE_USE_MOCK=1, para mexer no site sem depender do Drive. */
const DAY = 864e5;
const now = Date.now();

const data: Record<string, string[]> = {
    'SUPER NINTENDO ': ['Breath of Fire I.smc', 'Combatribes, The.sfc', 'The Brainies.sfc', 'Clock Tower.smc', 'Chrono Trigger(PT-BR).smc', 'Super Mario RPG - Legend of the Seven Stars.sfc', 'Dragon Ball Z - Super Butoden.smc', 'Dragon Ball Z - Hyper Dimension.smc', 'Captain Commando.smc', 'Civilization.sfc', '3 Ninjas Kick Back.smc', 'Cliffhanger.sfc', 'Claymates.sfc', 'Brandish.smc', 'Super Mario World (USA).sfc'],
    'GAME BOY ADVANCE (PT-BR)': ['Yu-Gi-Oh! The Eternal Duelist Soul (BR).gba', 'Yu-Gi-Oh! - The Sacred Cards (BR).gba', 'Yu Yu Hakusho - Tournament Tactics (BR).gba', 'Yu Yu Hakusho - Spirit Detective(br).gba', 'X-Men 3 - The Official Game (BR).gba', 'X-Men 2 - Wolverine\'s Revenge (BR).gba', 'X-Men - Reign of Apocalypse (BR).gba', 'Wario Land 4 (BR).gba', 'Van Helsing (BR).gba', 'Totally Spies! (BR).gba'],
    'MEGA DRIVE': ['Sonic The Hedgehog 2 (World) (Rev A).md', 'Streets of Rage 2 (USA).md', 'Gunstar Heroes (USA).md', 'Ecco the Dolphin (USA, Europe, Korea).md', 'Shinobi III - Return of the Ninja Master (USA).md', 'Comix Zone (USA).md', 'Phantasy Star IV (USA).md'],
    'NINTENDO 64': ['Super Mario 64 (USA).z64', 'Legend of Zelda, The - Ocarina of Time (USA) (Rev 2).z64', 'GoldenEye 007 (USA).z64', 'Mario Kart 64 (USA).z64', 'Star Fox 64 (USA) (Rev 1).z64', 'Banjo-Kazooie (USA).z64'],
    'NINTENDO 64 (PT-BR)': ['Super Mario 64 (PT-BR).z64', 'Paper Mario (PT-BR).z64'],
    'GAME BOY ADVANCE': ['Pokemon - Emerald Version (USA, Europe).gba', 'Metroid Fusion (USA).gba', 'Golden Sun (USA, Europe).gba', 'Advance Wars (USA).gba', 'Meu Hack Caseiro v2.gba'],
    'PS1': ['Crash Bandicoot (USA).chd', 'Final Fantasy VII (USA)/Final Fantasy VII (USA) (Disc 1).chd', 'Final Fantasy VII (USA)/Final Fantasy VII (USA) (Disc 2).chd', 'Castlevania - Symphony of the Night (USA).chd', 'Resident Evil 2 (USA) (Disc 1).chd', 'Spyro the Dragon (USA).chd'],
    'DREAMCAST': ['Crazy Taxi (USA).chd', 'Jet Grind Radio (USA).chd', 'Sonic Adventure (USA) (En,Ja,Fr,De,Es).chd'],
    'GAME BOY': ['Tetris (World) (Rev 1).gb', 'Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb', 'Kirby\'s Dream Land (USA, Europe).gb'],
    'NINTENDO / FAMICOM': ['Super Mario Bros. 3 (USA).nes', 'Mega Man 2 (USA).nes', 'Contra (USA).nes'],
    'SWITCH ': ['Jogos/The Legend of Zelda Echoes of Wisdom.nsp', 'Jogos/The Legend of Zelda Breath of the Wild.nsp', 'Jogos/Super Mario Party Jamboree.nsp', 'Jogos/Bayonetta 2.nsp', 'Jogos/Super Mario Galaxy 1.xci', 'DLC/The Legend of Zelda Breath of the Wild Switch NSP DLC.rar', 'DLC/Mario Kart 8 Deluxe [DLC Booster Course Pass] [0100152000023001][v65536].nsp', 'DLC/Monster Hunter Rise 264 DLC/Monster Hunter Rise DLC Pack 01.nsp', 'DLC/Monster Hunter Rise 264 DLC/Monster Hunter Rise DLC Pack 02.nsp', 'Updates/Bayonetta 2 Update v1.2.nsp'],
    'PS VITA': [],
    'PS4': ['Bloodborne.pkg', 'God of War.pkg'],
    'NINTENDO WII U': ['Mario Kart 8.wua'],
    'MEGA DRIVE PTBR': ['Sonic The Hedgehog (PT-BR).md']
};

const consoles: ApiConsole[] = Object.keys(data).map((name, i) => ({ id: 'c' + i, name }));

function games(id: string): ApiFile[] {
  const name = consoles.find((c) => c.id === id)!.name;
  return data[name].map((f, i) => {
    const parts = f.split('/');
    return {
      id: id + '_' + i,
      file: parts.pop()!,
      path: parts,
      size: Math.round(((0.3 + (hash(f) % 700)) * 1024 * 1024) / (/PS1|DREAM|SWITCH/.test(name) ? 1 : 25)),
      updated: now - (hash(f) % 300) * DAY,
    };
  });
}

export function mockCall(fn: string, a?: unknown): Promise<unknown> {
  const result = fn === 'getGames' ? games(String(a)) : consoles;
  return new Promise((res) => setTimeout(() => res(result), 150 + Math.random() * 500));
}
