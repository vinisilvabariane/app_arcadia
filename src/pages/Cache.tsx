import { Download, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InstallAction } from '../components/InstallCard';
import { EmptyBox, PageHero, SectionHead, Segmented, btnPlay, btnSoft } from '../components/ui';
import { HOME_TINT } from '../data/consoles';
import { ROM_CACHE_LIMITS } from '../data/play';
import { fmtDate, fmtSize, plural } from '../lib/format';
import { PLAY_ENABLED } from '../lib/play';
import {
  clearRoms,
  exportSaves,
  getNoCache,
  getRomLimit,
  importSaves,
  listRoms,
  listSaves,
  removeRom,
  removeSave,
  setNoCache,
  setRomLimit,
  type RomInfo,
  type SaveInfo,
} from '../lib/playdb';
import { useTint } from '../lib/useTint';
import { installAvailable, useInstall } from '../store/install';
import { useUi } from '../store/ui';

const KIND = { sram: 'Save do jogo', state: 'Estado salvo' } as const;
const LIMIT_OPTIONS = ROM_CACHE_LIMITS.map(([value, label]) => [String(value), label] as [string, string]);

/* Cache e saves: o que o "Jogar" guardou neste navegador. */
export function CachePage() {
  useTint(HOME_TINT);
  const toast = useUi((s) => s.toast);
  const canInstall = useInstall(installAvailable);
  const ios = useInstall((s) => s.ios);
  const standalone = useInstall((s) => s.standalone);
  const [roms, setRoms] = useState<RomInfo[] | null>(null);
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [limit, setLimit] = useState(getRomLimit);
  const [noCache, setNoCacheState] = useState(getNoCache);
  const [failed, setFailed] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    Promise.all([listRoms(), listSaves()])
      .then(([r, s]) => {
        setRoms(r);
        setSaves(s);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(refresh, [refresh]);

  const used = (roms || []).reduce((n, r) => n + r.size, 0);
  const savesSize = saves.reduce((n, s) => n + s.size, 0);
  const pct = Math.min(100, Math.round((used / limit) * 100));

  const changeLimit = async (value: string) => {
    const next = Number(value);
    setLimit(next);
    await setRomLimit(next);
    refresh();
  };
  const clear = async () => {
    await clearRoms();
    refresh();
    toast('Cache de ROMs limpo. Os saves continuam aí.');
  };
  const doExport = async () => {
    const { blob, count } = await exportSaves();
    if (!count) return toast('Ainda não tem save pra exportar');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arcadia-saves-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(plural(count, 'save exportado', 'saves exportados'));
  };
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { added, skipped } = await importSaves(file);
      refresh();
      toast(plural(added, 'save importado', 'saves importados') + (skipped ? ' · ' + skipped + ' mais antigos ignorados' : ''));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não deu pra importar');
    }
  };

  return (
    <>
      <PageHero eyebrow="Jogar no navegador" title="Cache e saves">
        As ROMs que você joga ficam guardadas aqui pra abrir mais rápido da próxima vez. Os <b>saves ficam separados</b> e nunca são apagados pela limpeza do cache.
      </PageHero>

      {!PLAY_ENABLED && (
        <section className="gutter mt-6">
          <EmptyBox>O “Jogar no navegador” está desligado: falta a chave de API do Drive, ou este navegador não tem o que o emulador precisa.</EmptyBox>
        </section>
      )}
      {failed && (
        <section className="gutter mt-6">
          <EmptyBox>Este navegador bloqueou o armazenamento local (modo privado?). Sem ele não dá pra guardar ROMs nem saves.</EmptyBox>
        </section>
      )}

      <section className="gutter mt-8 max-w-4xl">
        <SectionHead title="ROMs em cache" note={roms ? plural(roms.length, 'ROM', 'ROMs') : '…'} />
        <div className="rounded-2xl bg-ink-2 p-5 ring-1 ring-line">
          <div className="flex items-baseline justify-between gap-3 font-mono text-xs text-muted">
            <span>
              <b className="text-fg">{fmtSize(used) || '0 B'}</b> de {fmtSize(limit)}
            </span>
            <span>{pct}%</span>
          </div>
          <div role="progressbar" aria-label="Espaço usado pelo cache de ROMs" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-tint-hi" style={{ width: pct + '%' }} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="text-sm font-semibold">Limite</span>
            <Segmented label="Limite do cache de ROMs" value={String(limit)} onChange={changeLimit} options={LIMIT_OPTIONS} />
          </div>
          <p className="mt-2 text-xs text-muted">Quando enche, saem primeiro as ROMs que você jogou há mais tempo.</p>

          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={noCache}
              onChange={(e) => {
                setNoCache(e.target.checked);
                setNoCacheState(e.target.checked);
              }}
              className="size-4 accent-tint-hi"
            />
            Não guardar ROMs (jogar e descartar)
          </label>
        </div>

        {roms && roms.length > 0 && (
          <>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-ink-2 ring-1 ring-line">
              {roms.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">
                      {fmtSize(r.size)} · jogado em {fmtDate(r.lastPlayed)} · {plural(r.plays, 'vez', 'vezes')}
                    </div>
                  </div>
                  <button
                    onClick={() => removeRom(r.id).then(refresh)}
                    aria-label={'Tirar ' + r.name + ' do cache'}
                    title="Tirar do cache"
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-fg"
                  >
                    <X size={17} strokeWidth={2.4} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className={btnSoft} onClick={clear}>
                <Trash2 size={17} strokeWidth={2.2} />
                Limpar cache de ROMs
              </button>
              <span className="text-xs text-muted">Não apaga saves.</span>
            </div>
          </>
        )}
      </section>

      <section className="gutter mt-12 max-w-4xl">
        <SectionHead title="Saves" note={plural(saves.length, 'save', 'saves') + (savesSize ? ' · ' + fmtSize(savesSize) : '')} />
        <div className="rounded-lg bg-amber-400/10 px-3 py-2.5 text-[13px] text-amber-200 ring-1 ring-amber-400/25">Saves ficam só neste navegador. Exporte de vez em quando pra não perder.</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnPlay} onClick={doExport}>
            <Download size={18} strokeWidth={2.6} />
            Exportar saves
          </button>
          <button className={btnSoft} onClick={() => picker.current?.click()}>
            <Upload size={17} strokeWidth={2.3} />
            Importar saves
          </button>
          <input
            ref={picker}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              doImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        {saves.length > 0 && (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-ink-2 ring-1 ring-line">
            {saves.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.title || s.gameId}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">
                    {KIND[s.kind]} · {fmtSize(s.size)} · {fmtDate(s.updated)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Apagar este save de ' + (s.title || 'jogo') + '? Não dá pra desfazer.')) removeSave(s.id).then(refresh);
                  }}
                  aria-label={'Apagar ' + KIND[s.kind].toLowerCase() + ' de ' + (s.title || s.gameId)}
                  title="Apagar save"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-red-500/15 hover:text-red-300"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(canInstall || standalone) && (
        <section className="gutter mt-12 max-w-4xl">
          <SectionHead title="App" />
          <div className="rounded-2xl bg-ink-2 p-5 ring-1 ring-line">
            {standalone ? (
              <p className="text-sm text-fg/85">Você está usando o Arcádia instalado como app.</p>
            ) : (
              <>
                <p className="text-sm text-fg/85">Instale o Arcádia pra ter o ícone na tela inicial e abrir em tela cheia, sem a barra do navegador.</p>
                <InstallAction className="mt-4" />
                {ios && <p className="mt-3 text-xs text-muted">No iPhone e no iPad o app guarda os dados separado do Safari: exporte os saves aqui antes e importe depois, já dentro do app.</p>}
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
