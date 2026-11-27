/**
 * Arcádia — sua biblioteca pessoal de ROMs no Google Drive.
 *
 * CONFIGURAÇÃO: cole aqui o ID da pasta principal (a que contém as pastas dos consoles).
 * O ID é a parte final do link da pasta:
 *   https://drive.google.com/drive/folders/ESTE_PEDAÇO_AQUI
 */
const ROOT_FOLDER_ID = '1JAuY1LvEA8SxjXhMiHmf6FlXLbTCx-R2';

const CACHE_SECONDS = 6 * 60 * 60; // 6 horas (máximo do CacheService)
const CHUNK = 90 * 1024;           // CacheService aceita até 100KB por chave

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.fn) return ContentService.createTextOutput('Arcádia API ok');
  let result;
  try {
    if (p.fn === 'getConsoles') result = getConsoles(p.a === 'true');
    else if (p.fn === 'getGames') result = getGames(p.a, p.b === 'true');
    else if (p.fn === 'clearCache') result = clearCache();
    else throw new Error('função inválida');
  } catch (err) {
    result = { error: String(err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Lista as pastas de console (só nome e id — rápido). */
function getConsoles(forceRefresh) {
  const key = 'consoles:' + ROOT_FOLDER_ID;
  if (!forceRefresh) {
    const hit = getChunked_(key);
    if (hit) return hit;
  }
  const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const out = [];
  const it = root.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    out.push({ id: f.getId(), name: f.getName() });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  putChunked_(key, out);
  return out;
}

const MAX_DEPTH = 4;      // quantos níveis de subpasta ler dentro de cada console
const MAX_FILES = 8000;   // limite de segurança por console

/**
 * Lista os arquivos de um console, entrando nas subpastas.
 * Cada arquivo vem com "path": a lista de subpastas onde ele está
 * (ex.: SWITCH/DLC/Monster Hunter/arquivo.nsp -> path ["DLC", "Monster Hunter"]).
 */
function getGames(folderId, forceRefresh) {
  const key = 'games2:' + folderId;
  if (!forceRefresh) {
    const hit = getChunked_(key);
    if (hit) return hit;
  }
  const out = [];
  const pasta = DriveApp.getFolderById(folderId);
  walk_(pasta, [], out, 0);
  if (ARCADE_RE.test(pasta.getName())) nomesArcade_(out);
  out.sort((a, b) => a.file.localeCompare(b.file, 'pt-BR'));
  putChunked_(key, out);
  return out;
}

function walk_(folder, path, out, depth) {
  const files = folder.getFiles();
  while (files.hasNext() && out.length < MAX_FILES) {
    const f = files.next();
    const name = f.getName();
    if (name.indexOf(COPIADO_PREFIX) === 0) continue; // original de outra conta que já foi copiado pra você
    out.push({
      id: f.getId(),
      file: name,
      size: f.getSize(),
      updated: f.getLastUpdated().getTime(),
      path: path
    });
  }
  if (depth >= MAX_DEPTH) return;
  const subs = folder.getFolders();
  while (subs.hasNext() && out.length < MAX_FILES) {
    const s = subs.next();
    walk_(s, path.concat([s.getName().trim()]), out, depth + 1);
  }
}

/** Limpa o cache inteiro (botão "Recarregar" no app). */
function clearCache() {
  const consoles = getConsoles(true);
  const cache = CacheService.getUserCache();
  consoles.forEach(c => {
    removeChunked_(cache, 'games:' + c.id);
    removeChunked_(cache, 'games2:' + c.id);
  });
  return consoles;
}

// ---------- cache em pedaços ----------

function putChunked_(key, value) {
  const cache = CacheService.getUserCache();
  const json = JSON.stringify(value);
  const parts = Math.ceil(json.length / CHUNK) || 1;
  const map = {};
  for (let i = 0; i < parts; i++) map[key + ':' + i] = json.substr(i * CHUNK, CHUNK);
  map[key + ':n'] = String(parts);
  try { cache.putAll(map, CACHE_SECONDS); } catch (e) { /* cache cheio: segue sem cache */ }
}

function getChunked_(key) {
  const cache = CacheService.getUserCache();
  const n = Number(cache.get(key + ':n'));
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + ':' + i);
  const got = cache.getAll(keys);
  let json = '';
  for (const k of keys) {
    if (got[k] == null) return null;
    json += got[k];
  }
  return JSON.parse(json);
}

function removeChunked_(cache, key) {
  const n = Number(cache.get(key + ':n')) || 0;
  const keys = [key + ':n'];
  for (let i = 0; i < n; i++) keys.push(key + ':' + i);
  cache.removeAll(keys);
}

// ======================= DUPLICADOS =======================
// Consoles onde só vale duplicata exata (mesmo nome e tamanho), porque o nome tem DLC/update/romset
const DUP_EXATOS = /switch|wii ?u|ps ?3|ps ?4|vita|xbox|arcade|mame|neo ?geo/i;
// Formatos de disco: .cue e .bin do mesmo jogo NÃO são duplicata um do outro
const DUP_DISCO = /^(cue|bin|iso|img|chd|ccd|sub|mdf|mds|pbp|cso|gdi|raw|wbfs|rvz|gcm|nrg)$/;

function dupFamilia_(name) {
  return name.replace(/\([^)]*\)/g, ' ').replace(/\bpt[\s_-]?br\b/ig, ' ')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}
function dupTitulo_(file) {
  return file.replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/_/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}
function dupDisco_(file) {
  const m = file.match(/\((?:disc|disk|cd)\s*\d+[^)]*\)/i);
  return m ? m[0].toLowerCase().replace(/\s+/g, '') : '';
}
// 'pt' = traduzido/brasileiro (pelo nome do arquivo ou da pasta); 'en' = o resto
function dupIdioma_(file, consoleName) {
  return /pt[\s_-]?br|brazil|brasil|traduz|\(br\)/i.test(file + ' ' + consoleName) ? 'pt' : 'en';
}
// Quanto maior, mais "preferida". USA sempre na frente.
function dupPontos_(file) {
  let s = 0;
  if (/\(usa\)/i.test(file)) s += 110;
  else if (/\busa\b/i.test(file)) s += 100;
  else if (/\(world/i.test(file)) s += 80;
  else if (/europe/i.test(file)) s += 40;
  else if (/japan/i.test(file)) s += 20;
  else s += 10;
  if (/\((beta|proto|demo|sample|pirate|unl|aftermarket)/i.test(file)) s -= 80;
  const rev = file.match(/\(rev ([0-9a-z]+)\)/i);
  if (rev) s += /^\d+$/.test(rev[1]) ? Math.min(Number(rev[1]), 9) : rev[1].toUpperCase().charCodeAt(0) - 64;
  if (/\.(zip|7z|rar)$/i.test(file)) s -= 1;
  return s;
}

/** PASSO 1: só gera a planilha. Não mexe em nenhum arquivo. */
function gerarRelatorioDuplicados() {
  const grupos = {};
  getConsoles(false).forEach(c => {
    if (/^recomps?$/i.test(c.name.trim())) return;
    const exato = DUP_EXATOS.test(c.name);
    const fam = dupFamilia_(c.name);
    getGames(c.id, false).forEach(f => {
      const ext = (f.file.match(/\.([a-z0-9]{1,5})$/i) || ['', ''])[1].toLowerCase();
      const lang = dupIdioma_(f.file, c.name);
      const k = exato
        ? 'x|' + lang + '|' + fam + '|' + f.file.toLowerCase() + '|' + f.size
        : 'v|' + lang + '|' + fam + '|' + (DUP_DISCO.test(ext) ? ext : 'rom') + '|' + dupTitulo_(f.file) + '|' + dupDisco_(f.file);
      (grupos[k] = grupos[k] || []).push({ f: f, console: c.name, exato: exato, lang: lang });
    });
  });

  const linhas = [];
  let g = 0;
  Object.keys(grupos).forEach(k => {
    const lista = grupos[k];
    if (lista.length < 2) return;
    g++;
    lista.forEach(x => { x.pts = x.exato ? 0 : dupPontos_(x.f.file); });
    lista.sort((a, b) => (b.pts - a.pts) || (a.f.updated - b.f.updated));
    lista.forEach((x, i) => {
      const idioma = x.lang === 'pt' ? 'PT-BR' : 'inglês';
      linhas.push([
        g, x.console, x.f.file, i === 0 ? 'MANTER' : 'REMOVER',
        Math.round(x.f.size / 104857.6) / 10,
        x.exato ? 'Cópia idêntica (' + idioma + ')' : (i === 0 ? 'Versão preferida em ' + idioma : 'Duplicado em ' + idioma),
        x.f.id, 'https://drive.google.com/file/d/' + x.f.id + '/view'
      ]);
    });
  });
  if (!linhas.length) { Logger.log('Nenhum duplicado encontrado.'); return; }

  const ss = SpreadsheetApp.create('Arcádia - duplicados ' + new Date().toISOString().slice(0, 10));
  const sh = ss.getSheets()[0];
  sh.getRange(1, 1, 1, 8).setValues([['Grupo', 'Console', 'Arquivo', 'Ação', 'Tamanho (MB)', 'Motivo', 'ID', 'Link']]).setFontWeight('bold');
  sh.getRange(2, 1, linhas.length, 8).setValues(linhas);
  sh.getRange(2, 4, linhas.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['MANTER', 'REMOVER'], true).build());
  sh.setFrozenRows(1);
  PropertiesService.getScriptProperties().setProperty('DUP_SHEET', ss.getId());
  Logger.log(g + ' grupos, ' + linhas.length + ' arquivos. Planilha: ' + ss.getUrl());
}

/** PASSO 2: manda pra lixeira o que estiver como REMOVER na planilha. */
function removerDuplicados() {
  const id = PropertiesService.getScriptProperties().getProperty('DUP_SHEET');
  if (!id) throw new Error('Rode gerarRelatorioDuplicados() primeiro.');
  const sh = SpreadsheetApp.openById(id).getSheets()[0];
  const dados = sh.getDataRange().getValues();
  const ficam = {};
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][3] !== 'REMOVER' && dados[i][3] !== 'REMOVIDO') ficam[dados[i][0]] = true;
  }
  const t0 = Date.now();
  let ok = 0, erros = 0;
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][3] !== 'REMOVER') continue;
    if (Date.now() - t0 > 5 * 60 * 1000) { Logger.log('Tempo esgotado: rode de novo para continuar.'); break; }
    if (!ficam[dados[i][0]]) { sh.getRange(i + 1, 4).setValue('PULADO: ficaria sem nenhuma cópia'); continue; }
    try {
      DriveApp.getFileById(dados[i][6]).setTrashed(true);
      sh.getRange(i + 1, 4).setValue('REMOVIDO');
      ok++;
    } catch (e) {
      sh.getRange(i + 1, 4).setValue('ERRO: ' + e.message);
      erros++;
    }
  }
  clearCache();
  Logger.log(ok + ' enviados pra lixeira, ' + erros + ' com erro.');
}

// ======================= TRAZER ARQUIVOS DE OUTRAS CONTAS =======================
// Quando um amigo sobe jogos na sua pasta, o arquivo continua sendo DELE (ocupa o espaço dele
// e some se ele apagar). Isto faz uma cópia sua de cada arquivo que não é seu, no mesmo lugar,
// e tira o original da sua pasta. A cópia acontece dentro do Google: nada é baixado.
//
// Também dá pra puxar de uma pasta que fica no Drive do amigo e foi compartilhada com você:
// coloque o ID dela abaixo. Ela deve ter subpastas com os mesmos nomes dos seus consoles
// (ex.: SNES, PS1...). Pasta de console que não existir do seu lado é criada.
const PASTAS_DO_AMIGO = [
  // 'ID_DA_PASTA_DO_AMIGO',
];
// Nome que o original ganha quando não dá pra tirá-lo da sua pasta. O site ignora esses arquivos.
const COPIADO_PREFIX = '[COPIADO] ';
const COPIA_MAX_MS = 5 * 60 * 1000;   // o Apps Script corta em 6 min: para antes e continua na próxima
const COPIA_PROFUNDIDADE = 6;

/**
 * Rode esta função (ou ligue a automática abaixo). Pode rodar quantas vezes quiser:
 * o que já foi copiado é pulado.
 */
function trazerArquivosDeOutros() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('Já tem uma cópia rodando. Tente de novo daqui a pouco.'); return; }
  const st = { t0: Date.now(), copiados: 0, jaTinha: 0, semEspaco: 0, erros: 0, bytes: 0, parou: false,
    livre: espacoLivre_(), log: [], meus: {} };
  try {
    const raiz = DriveApp.getFolderById(ROOT_FOLDER_ID);
    // 1) arquivos de outras contas que estão dentro das suas pastas
    copiarPasta_(raiz, raiz, true, st, 0);
    // 2) pastas que ficam no Drive do amigo (opcional)
    PASTAS_DO_AMIGO.forEach(id => {
      if (st.parou) return;
      try { copiarPasta_(DriveApp.getFolderById(id), raiz, false, st, 0); }
      catch (e) { st.erros++; st.log.push('Não consegui abrir a pasta ' + id + ': ' + e.message); }
    });
  } finally {
    lock.releaseLock();
  }
  if (st.copiados) clearCache();
  // progresso acumulado entre as rodadas
  const props = PropertiesService.getScriptProperties();
  const total = Number(props.getProperty('COPIA_TOTAL') || 0) + st.copiados;
  props.setProperty('COPIA_TOTAL', String(total));
  // acabou o tempo: agenda a continuação sozinha daqui a 1 minuto, até terminar tudo
  if (st.parou) agendarContinuacao_(); else { cancelarContinuacao_(); props.setProperty('COPIA_TOTAL', '0'); }
  Logger.log(st.log.join('\n'));
  Logger.log('Copiados nesta rodada: ' + st.copiados + ' (' + fmtGB_(st.bytes) + ') · já existiam: ' + st.jaTinha +
    ' · sem espaço: ' + st.semEspaco + ' · erros: ' + st.erros +
    (st.parou ? '\nAinda tem arquivo: continua sozinho em 1 minuto (total até agora: ' + total + ').' : '\nTudo em dia. Total copiado: ' + total + '.'));
}

/** Chamada pelo agendamento automático: continua de onde parou. */
function continuarCopia() {
  cancelarContinuacao_();
  trazerArquivosDeOutros();
}
function agendarContinuacao_() {
  cancelarContinuacao_();
  ScriptApp.newTrigger('continuarCopia').timeBased().after(60 * 1000).create();
}
function cancelarContinuacao_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'continuarCopia')
    .forEach(t => ScriptApp.deleteTrigger(t));
}
/** Para tudo: a continuação automática e a cópia de hora em hora. */
function pararCopia() {
  desligarCopiaAutomatica();
  Logger.log('Cópia parada. Pra voltar, rode trazerArquivosDeOutros (ou ligarCopiaAutomatica).');
}

/**
 * Percorre "origem" e copia pra "destino" os arquivos que não são seus.
 * mesmaPasta = true: origem e destino são a mesma pasta (arquivos do amigo dentro das suas pastas).
 */
function copiarPasta_(origem, destino, mesmaPasta, st, prof) {
  if (st.parou) return;
  const it = origem.searchFiles("not 'me' in owners and trashed = false");
  while (it.hasNext()) {
    if (Date.now() - st.t0 > COPIA_MAX_MS) { st.parou = true; return; }
    const f = it.next();
    const nome = f.getName();
    if (nome.indexOf(COPIADO_PREFIX) === 0) continue;
    const tam = f.getSize();
    const onde = destino.getName() + '/' + nome;
    try {
      if (temCopiaMinha_(destino, nome, tam, st)) {
        st.jaTinha++;
      } else {
        if (st.livre !== null && tam > st.livre) { st.semEspaco++; st.log.push('Sem espaço no seu Drive: ' + onde + ' (' + fmtGB_(tam) + ')'); continue; }
        f.makeCopy(nome, destino);
        st.meus[destino.getId()][nome + '|' + tam] = 1;
        st.copiados++; st.bytes += tam;
        if (st.livre !== null) st.livre -= tam;
        if (st.log.length < 200) st.log.push('Copiado: ' + onde + ' (' + fmtGB_(tam) + ')');
      }
      if (mesmaPasta) tirarOriginal_(f, origem, st);
    } catch (e) {
      // sem a permissão de escrita no Drive nada vai funcionar: para na hora em vez de errar em tudo
      if (/auth\/drive|permiss/i.test(e.message)) {
        throw new Error('O script não tem permissão para criar arquivos no seu Drive. ' +
          'Abra o appsscript.json, troque "drive.readonly" por "https://www.googleapis.com/auth/drive", salve e rode de novo (vai pedir autorização).');
      }
      st.erros++;
      if (st.log.length < 200) st.log.push('Erro em ' + onde + ': ' + e.message);
    }
  }
  if (prof >= COPIA_PROFUNDIDADE) return;
  const subs = origem.getFolders();
  while (subs.hasNext() && !st.parou) {
    const s = subs.next();
    const alvo = mesmaPasta ? s : subpasta_(destino, s.getName());
    copiarPasta_(s, alvo, mesmaPasta, st, prof + 1);
  }
}

/** Já existe na pasta um arquivo SEU com o mesmo nome e tamanho?
    Lê a lista dos seus arquivos de cada pasta uma vez só (bem mais rápido que procurar um por um). */
function temCopiaMinha_(pasta, nome, tam, st) {
  const id = pasta.getId();
  if (!st.meus[id]) {
    const mapa = {};
    const it = pasta.searchFiles("'me' in owners and trashed = false");
    while (it.hasNext()) { const f = it.next(); mapa[f.getName() + '|' + f.getSize()] = 1; }
    st.meus[id] = mapa;
  }
  return !!st.meus[id][nome + '|' + tam];
}

/** Tira o original do amigo da sua pasta. Se o Drive não deixar, renomeia pra o site ignorar. */
function tirarOriginal_(f, pasta, st) {
  try { pasta.removeFile(f); return; } catch (e) { /* tenta o plano B */ }
  try {
    f.setName(COPIADO_PREFIX + f.getName());
    st.log.push('  (não deu pra tirar o original da pasta; ele foi renomeado com ' + COPIADO_PREFIX.trim() + ' e o dono pode apagar)');
  } catch (e) {
    st.log.push('  (não deu pra tirar nem renomear o original: ' + e.message + '. Ele pode aparecer duplicado no site)');
  }
}

/** Acha a subpasta pelo nome (sem diferenciar maiúsculas e espaços nas pontas) ou cria. */
function subpasta_(pai, nome) {
  const alvo = nome.trim().toLowerCase();
  const it = pai.getFolders();
  while (it.hasNext()) {
    const s = it.next();
    if (s.getName().trim().toLowerCase() === alvo) return s;
  }
  return pai.createFolder(nome.trim());
}

function espacoLivre_() {
  const limite = DriveApp.getStorageLimit();
  return limite > 0 ? limite - DriveApp.getStorageUsed() : null; // null = ilimitado
}
function fmtGB_(b) { return (b / 1073741824).toFixed(2).replace('.', ',') + ' GB'; }

/** Liga a cópia automática (a cada hora) e a atualização dos nomes de arcade (1x por dia). */
function ligarCopiaAutomatica() {
  desligarCopiaAutomatica();
  ScriptApp.newTrigger('trazerArquivosDeOutros').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('atualizarNomesArcade').timeBased().everyDays(1).atHour(4).create();
  Logger.log('Ligado: cópia a cada hora e nomes de arcade 1x por dia.');
}
function desligarCopiaAutomatica() {
  ScriptApp.getProjectTriggers()
    .filter(t => /^(trazerArquivosDeOutros|atualizarNomesArcade|continuarCopia)$/.test(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// ======================= NOMES DOS JOGOS DE ARCADE =======================
// No arcade (MAME/FBNeo) o arquivo TEM que ter o nome curto ("galaga.zip", "kof2002.zip"):
// se renomear, o emulador não acha o jogo. Por isso o arquivo continua igual no Drive e só o
// nome que a API manda pro site muda: "Galaga (Namco rev. B) [galaga].zip".
// Arquivos de BIOS vão pra uma pasta "BIOS" no site.
const ARCADE_RE = /arcade|mame|neo ?geo|fbneo|fba|cps|naomi|atomiswave/i;
const ARCADE_FONTES = {
  mame: 'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/mame/MAME.dat',
  bios: 'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/mame/MAME%20BIOS.dat',
  fbneo: 'https://raw.githubusercontent.com/libretro/FBNeo/master/dats/FinalBurn%20Neo%20(ClrMame%20Pro%20XML%2C%20Arcade%20only).dat',
  neogeo: 'https://raw.githubusercontent.com/libretro/FBNeo/master/dats/FinalBurn%20Neo%20(ClrMame%20Pro%20XML%2C%20Neogeo%20only).dat'
};
const ARCADE_MAPA_NOME = '_arcadia-nomes-arcade.json';
const ARCADE_BIOS_EXTRA = /bios|^coh\d{4}[a-z]?$|^(cubo|cedmag|nichidvd|alg3do|neogeo|pgm|skns|stvbios|naomi2?|hod2bios|f355bios|decocass|konamigx|nss|playch10|megaplay|megatech)$/;

/**
 * Baixa as listas oficiais de nomes (MAME e FBNeo) e guarda só os nomes dos jogos que você tem.
 * Rode uma vez agora e de novo quando entrar jogo novo de arcade (a automática faz 1x por dia).
 */
function atualizarNomesArcade() {
  // 1) quais nomes curtos existem nas suas pastas de arcade
  const curtos = {};
  getConsoles(true).filter(c => ARCADE_RE.test(c.name)).forEach(c => {
    const lista = [];
    walk_(DriveApp.getFolderById(c.id), [], lista, 0);
    lista.forEach(f => { const k = curtoArcade_(f.file); if (k) curtos[k] = 1; });
  });
  const total = Object.keys(curtos).length;
  if (!total) { Logger.log('Nenhuma pasta de arcade encontrada (nomes com ARCADE, MAME, NEO GEO...).'); return; }

  // 2) nomes completos: MAME primeiro, FBNeo completa o que faltar
  const mapa = {};
  lerDatClrmame_(baixar_(ARCADE_FONTES.mame), curtos, mapa, false);
  lerDatClrmame_(baixar_(ARCADE_FONTES.bios), curtos, mapa, true);
  [ARCADE_FONTES.fbneo, ARCADE_FONTES.neogeo].forEach(url => {
    try { lerDatXml_(baixar_(url), curtos, mapa); } catch (e) { Logger.log('Pulei ' + url + ': ' + e.message); }
  });

  // 3) salva num arquivo pequeno dentro da sua pasta principal
  const json = JSON.stringify(mapa);
  const props = PropertiesService.getScriptProperties();
  let arq = null;
  try { arq = DriveApp.getFileById(props.getProperty('ARCADE_MAPA')); if (arq.isTrashed()) arq = null; } catch (e) { arq = null; }
  if (arq) arq.setContent(json);
  else {
    arq = DriveApp.getFolderById(ROOT_FOLDER_ID).createFile(ARCADE_MAPA_NOME, json, MimeType.PLAIN_TEXT);
    props.setProperty('ARCADE_MAPA', arq.getId());
  }
  CacheService.getScriptCache().remove('arcmapa');
  clearCache();

  const faltam = Object.keys(curtos).filter(k => !mapa[k]);
  Logger.log('Arcade: ' + (total - faltam.length) + ' de ' + total + ' arquivos com nome encontrado.' +
    (faltam.length ? '\nSem nome nas listas: ' + faltam.slice(0, 80).join(', ') + (faltam.length > 80 ? '…' : '') : ''));
}

/** "galaga.zip" -> "galaga"; ignora o que não parece set de arcade. */
function curtoArcade_(file) {
  const m = String(file).match(/^([a-z0-9_]+)\.(zip|7z|chd)$/i);
  return m ? m[1].toLowerCase() : null;
}
function baixar_(url) {
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
  return r.getContentText();
}
function desescapar_(s) {
  return s.replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\\"/g, '"');
}
/** Formato clrmamepro do libretro: game ( name "Título" year "1981" developer "X" rom ( name curto.zip ... ) ) */
function lerDatClrmame_(txt, curtos, mapa, bios) {
  txt.split(/\n\s*game \(/).forEach(bloco => {
    const rom = bloco.match(/rom \( name ([^\s]+?)\.zip/);
    if (!rom) return;
    const k = rom[1].toLowerCase();
    if (!curtos[k]) return;
    if (mapa[k]) { if (bios) mapa[k].b = 1; return; }
    const t = bloco.match(/name "((?:[^"\\]|\\.)*)"/);
    if (!t) return;
    const y = bloco.match(/(?:release)?year "(\d{4})/);
    const d = bloco.match(/developer "((?:[^"\\]|\\.)*)"/);
    mapa[k] = { t: desescapar_(t[1]), y: y ? y[1] : '', d: d ? desescapar_(d[1]) : '' };
    if (bios) mapa[k].b = 1;
  });
}
/** Formato XML do FBNeo: <game name="curto" ...><description>Título</description><year>..</year><manufacturer>..</manufacturer> */
function lerDatXml_(txt, curtos, mapa) {
  const re = /<game name="([^"]+)"([^>]*)>\s*<description>([^<]*)<\/description>\s*(?:<year>([^<]*)<\/year>)?\s*(?:<manufacturer>([^<]*)<\/manufacturer>)?/g;
  let m;
  while ((m = re.exec(txt))) {
    const k = m[1].toLowerCase();
    if (!curtos[k] || mapa[k]) continue;
    mapa[k] = { t: desescapar_(m[3]), y: (m[4] || '').slice(0, 4), d: desescapar_(m[5] || '') };
    if (/isbios="yes"/.test(m[2])) mapa[k].b = 1;
  }
}
function mapaArcade_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('arcmapa');
  if (hit) return JSON.parse(hit);
  const id = PropertiesService.getScriptProperties().getProperty('ARCADE_MAPA');
  if (!id) return {};
  let mapa = {};
  try { mapa = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString()); } catch (e) { return {}; }
  try { cache.put('arcmapa', JSON.stringify(mapa), CACHE_SECONDS); } catch (e) { /* maior que 100KB: lê do Drive sempre */ }
  return mapa;
}
/** Troca o nome que vai pro site (o arquivo no Drive continua igual). */
function nomesArcade_(lista) {
  const mapa = mapaArcade_();
  lista.forEach(f => {
    const k = curtoArcade_(f.file);
    const m = k && mapa[k];
    if (!m) {
      // BIOS mais novas que não estão nas listas: só manda pra pasta BIOS
      if (k && ARCADE_BIOS_EXTRA.test(k)) f.path = ['BIOS'].concat(f.path);
      return;
    }
    const ext = f.file.slice(f.file.lastIndexOf('.'));
    f.real = f.file;                                   // nome verdadeiro do arquivo
    f.file = m.t.replace(/[\/\\]/g, '-') + ' [' + k + ']' + ext;
    if (m.y) f.year = m.y;
    if (m.d) f.developer = m.d;
    if (m.b) f.path = ['BIOS'].concat(f.path);
  });
}
