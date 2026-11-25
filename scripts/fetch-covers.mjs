// Gera public/covers/<sistema>.json: a lista de nomes das capas de cada console
// no acervo libretro-thumbnails, e public/covers/manifest.json com a assinatura de cada lista.
// Roda no deploy (GitHub Actions), antes do build.
//
// Por que no build e não no navegador: a API do GitHub aceita só 60 chamadas por hora
// por IP sem login. No navegador isso estourava e o site ficava sem capas.
// Com GITHUB_TOKEN (que o Actions fornece) o limite é bem maior.
//
// Se a API recusar (limite estourado), cai pro git, que não tem limite.
//
// Uso local (opcional):  npm run covers
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const OUT = new URL('../public/covers/', import.meta.url);
const source = await readFile(new URL('../src/data/consoles.ts', import.meta.url), 'utf8');
const systems = [...new Set([...source.matchAll(/sys: '([^']+)'/g)].map((m) => m[1]))];

const headers = { 'User-Agent': 'arcadia-build', Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;

async function json(url) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return r.json();
}

// Reserva sem API (e sem limite): baixa só a árvore de pastas do repositório, sem as imagens.
async function namesViaGit(sys) {
  const dir = await mkdtemp(join(tmpdir(), 'arcadia-capas-'));
  try {
    const repo = `https://github.com/libretro-thumbnails/${sys.replace(/ /g, '_')}.git`;
    await run('git', ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--no-checkout', repo, dir]);
    const { stdout } = await run('git', ['-C', dir, 'ls-tree', '-z', '--name-only', 'HEAD:Named_Boxarts'], { maxBuffer: 64 * 1024 * 1024 });
    return stdout
      .split('\0')
      .filter((p) => /\.png$/i.test(p))
      .map((p) => p.replace(/\.png$/i, ''));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function namesViaApi(sys) {
  const api = `https://api.github.com/repos/libretro-thumbnails/${sys.replace(/ /g, '_')}/git/trees/`;
  const root = await json(api + 'master');
  const boxarts = root.tree.find((e) => e.path === 'Named_Boxarts');
  if (!boxarts) return [];
  const sub = await json(api + boxarts.sha);
  if (sub.truncated) console.warn(`  ! ${sys}: lista cortada pelo GitHub`);
  return sub.tree.filter((e) => /\.png$/i.test(e.path)).map((e) => e.path.replace(/\.png$/i, ''));
}

await mkdir(OUT, { recursive: true });
let ok = 0;
// manifest.json: uma "assinatura" curta de cada lista (quantidade:soma dos tamanhos dos nomes).
// O site compara com a que tem guardada e só baixa de novo a lista que mudou.
// A conta tem que ser a mesma de signature() em src/lib/covers.ts.
const manifest = {};
const queue = [...systems];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let sys; (sys = queue.shift()); ) {
      try {
        const list = await namesViaApi(sys).catch(() => namesViaGit(sys));
        await writeFile(new URL(sys.replace(/ /g, '_') + '.json', OUT), JSON.stringify(list));
        manifest[sys] = list.length + ':' + list.reduce((n, x) => n + x.length, 0);
        console.log(`  ${sys}: ${list.length} capas`);
        ok++;
      } catch (e) {
        // sem a lista o site ainda funciona: ele tenta a API do GitHub direto do navegador
        console.warn(`  ! ${sys}: ${e.message}`);
      }
    }
  }),
);
await writeFile(new URL('manifest.json', OUT), JSON.stringify(manifest));
console.log(`capas: ${ok}/${systems.length} listas geradas`);
