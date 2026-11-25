/* Service worker da Arcádia: guarda o site no navegador pra abrir rápido (e até sem internet).

   O que fica guardado, e como:
   - assets/ (JS e CSS do site)  -> o nome do arquivo muda a cada versão, então guarda pra sempre.
   - capas (wsrv.nl)             -> guarda pra sempre: a mesma URL devolve sempre a mesma imagem.
   - fontes do Google            -> arquivos de fonte pra sempre; o CSS delas usa o guardado e atualiza por trás.
   - o resto do site (index.html, listas de capas) -> tenta a rede primeiro, pra versão nova
     aparecer na hora; sem rede, usa o que estiver guardado.

   O acervo (lista de jogos do Drive) não passa por aqui: quem guarda é o próprio site, no IndexedDB. */

const APP = 'arcadia-app-v1';
const COVERS = 'arcadia-capas-v1';
const FONTS = 'arcadia-fontes-v1';
const KEEP = [APP, COVERS, FONTS];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('arcadia-') && !KEEP.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

/* Só guarda resposta boa e legível. Resposta "opaca" (pedido sem CORS) não dá pra saber se deu
   certo, e o Chrome ainda desconta vários MB da cota por cada uma. */
function keep(cache, request, response) {
  if (response.ok && response.type !== 'opaque') cache.put(request, response.clone()).catch(() => {});
  return response;
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  return (await cache.match(request)) || keep(cache, request, await fetch(request));
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  const fresh = fetch(request).then((response) => keep(cache, request, response));
  if (!saved) return fresh;
  fresh.catch(() => {});
  return saved;
}

async function networkFirst(request) {
  const cache = await caches.open(APP);
  try {
    const response = keep(cache, request, await fetch(request));
    if (request.mode === 'navigate' && response.ok) dropOldAssets(cache, response.clone());
    return response;
  } catch (err) {
    const saved = await cache.match(request);
    if (saved) return saved;
    throw err;
  }
}

/* Chegou um index.html novo: apaga o JS/CSS de versões antigas que ele não usa mais. */
async function dropOldAssets(cache, page) {
  try {
    const html = await page.text();
    for (const request of await cache.keys()) {
      const file = request.url.split('/assets/')[1];
      // só os arquivos principais (index-*): as telas baixadas sob demanda não aparecem no index.html
      if (file && file.startsWith('index-') && !html.includes('assets/' + file)) await cache.delete(request);
    }
  } catch {
    /* limpeza é só capricho: se falhar, segue */
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(url.pathname.includes('/assets/') ? cacheFirst(APP, request) : networkFirst(request));
  } else if (url.hostname === 'wsrv.nl') {
    event.respondWith(cacheFirst(COVERS, request));
  } else if (url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(FONTS, request));
  } else if (url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(FONTS, request));
  }
  // qualquer outra coisa (Apps Script, Wikipédia) segue direto pra rede
});
