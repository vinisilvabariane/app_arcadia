/* Gera os ícones do app (PNG) em public/icons/, a partir do mesmo desenho do favicon.svg.
   Não usa nenhuma biblioteca: desenha ponto a ponto e escreve o PNG na mão.

   Rode só quando mudar o desenho ou as cores:  npm run icons
   Os PNGs gerados ficam no repositório (o deploy não roda este script). */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const AMBER = hex('#e8a33d');
const AMBER_DARK = hex('#5d4118');
const SCREEN = hex('#0b0c12');
const BG_TOP = hex('#232637');
const BG_BOTTOM = hex('#0b0c12');
const WHITE = [1, 1, 1];
const BLACK = [0, 0, 0];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/* ---------- formas, nas coordenadas do desenho (0 a 40) ---------- */

/** retângulo de cantos arredondados */
function inRound(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** distância do ponto até o segmento a-b */
function distSeg(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

/** traço: está a até `half` de distância da linha que liga os pontos */
const onLine = (x, y, pts, half) => pts.some((p, i) => i > 0 && distSeg(x, y, ...pts[i - 1], ...p) <= half);

// dobra do canto do cartucho: desce, faz a curva e segue pra direita
const FOLD = [[27.5, 3], [27.5, 8]];
for (let i = 1; i <= 8; i++) {
  const a = ((Math.PI / 2) * i) / 8;
  FOLD.push([30 - 2.5 * Math.cos(a), 8 + 2.5 * Math.sin(a)]);
}
FOLD.push([35, 10.5]);

const LETTER_A = [[14.2, 30.6], [20, 18.2], [25.8, 30.6]];

/** corpo do cartucho: retângulo arredondado com o canto de cima à direita cortado */
const inBody = (x, y) => inRound(x, y, 5, 3, 30, 35, 3) && x - y <= 24.5;

/** Camadas do cartucho num ponto, de baixo pra cima: [cor, opacidade]. */
function cartridge(x, y) {
  if (!inBody(x, y)) return [];
  const layers = [[mix(AMBER, AMBER_DARK, ((x - 5) / 30 + (y - 3) / 35) / 2), 1]];
  if (onLine(x, y, FOLD, 0.7)) layers.push([BLACK, 0.25]);
  if (onLine(x, y, [[10, 7], [21, 7]], 0.8) || onLine(x, y, [[10, 10], [21, 10]], 0.8)) layers.push([BLACK, 0.3]);
  if (inRound(x, y, 9, 14, 22, 20.5, 3)) layers.push([SCREEN, 1]);
  if (onLine(x, y, LETTER_A, 1.55)) layers.push([AMBER, 1]);
  if (inRound(x, y, 17.6, 25.2, 4.8, 2.6, 1.3)) layers.push([WHITE, 1]);
  return layers;
}

/* ---------- desenhar e escrever o PNG ---------- */

/** size: lado em pixels · art: fração do lado ocupada pelo desenho · radius: cantos do fundo (fração do lado; 0 = quadrado) */
function draw(size, art, radius) {
  const SS = 4; // 4x4 pontos por pixel, pra borda ficar lisa
  const scale = (size * art) / 40;
  // centro do cartucho (20, 20.5) no centro do ícone
  const ox = size / 2 - 20 * scale;
  const oy = size / 2 - 20.5 * scale;
  const px = Buffer.alloc(size * size * 4);

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const fx = i + (si + 0.5) / SS;
          const fy = j + (sj + 0.5) / SS;
          if (!inRound(fx, fy, 0, 0, size, size, radius * size)) continue;
          let c = mix(BG_TOP, BG_BOTTOM, fy / size);
          for (const [color, alpha] of cartridge((fx - ox) / scale, (fy - oy) / scale)) c = mix(c, color, alpha);
          r += c[0];
          g += c[1];
          b += c[2];
          a += 1;
        }
      }
      const at = (j * size + i) * 4;
      if (a) {
        px[at] = Math.round((r / a) * 255);
        px[at + 1] = Math.round((g / a) * 255);
        px[at + 2] = Math.round((b / a) * 255);
      }
      px[at + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return px;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, px) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8; // 8 bits por canal
  head[9] = 6; // RGBA
  // cada linha começa com um byte de filtro (0 = nenhum)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let j = 0; j < size; j++) px.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* arquivo, lado, tamanho do desenho, cantos
   - icon-*: ícone normal, já com os cantos arredondados
   - maskable: o Android recorta no formato que quiser, então o fundo vai até a borda e o desenho fica menor
   - apple-touch-icon: o iPhone arredonda sozinho e não aceita transparência */
const ICONS = [
  ['icon-192.png', 192, 0.74, 0.22],
  ['icon-512.png', 512, 0.74, 0.22],
  ['maskable-512.png', 512, 0.6, 0],
  ['apple-touch-icon.png', 180, 0.72, 0],
];

mkdirSync(OUT, { recursive: true });
for (const [file, size, art, radius] of ICONS) {
  const data = png(size, draw(size, art, radius));
  writeFileSync(join(OUT, file), data);
  console.log(file, size + 'px', (data.length / 1024).toFixed(1) + ' KB');
}
