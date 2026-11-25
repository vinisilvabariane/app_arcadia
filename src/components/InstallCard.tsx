import { Download, Share, X } from 'lucide-react';
import { installAvailable, useInstall } from '../store/install';
import { useUi } from '../store/ui';
import { btnGo } from './ui';

/** Botão "Instalar app" (ou, no iPhone, o caminho pelo menu Compartilhar). */
export function InstallAction({ className = '' }: { className?: string }) {
  const canPrompt = useInstall((s) => s.canPrompt);
  const install = useInstall((s) => s.install);
  const toast = useUi((s) => s.toast);

  if (canPrompt) {
    return (
      <button
        className={btnGo + ' ' + className}
        onClick={async () => {
          if (await install()) toast('Arcádia instalado');
        }}
      >
        <Download size={17} strokeWidth={2.5} />
        Instalar app
      </button>
    );
  }
  return (
    <p className={'text-[13px] leading-relaxed text-fg/85 ' + className}>
      Toque em <Share size={15} strokeWidth={2.3} className="mx-0.5 inline align-[-2px] text-tint-hi" aria-label="Compartilhar" /> <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.
    </p>
  );
}

/** Convite pra instalar: aparece uma vez, flutuando no canto, até a pessoa instalar ou fechar. */
export function InstallCard() {
  const available = useInstall(installAvailable);
  const dismissed = useInstall((s) => s.dismissed);
  const dismiss = useInstall((s) => s.dismiss);
  if (!available || dismissed) return null;

  return (
    <aside
      aria-label="Instalar o Arcádia"
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm animate-rise rounded-2xl bg-ink-3 p-4 shadow-[0_18px_50px_-12px_#000] ring-1 ring-line lg:inset-x-auto lg:right-6 lg:bottom-6 lg:mx-0"
    >
      <div className="flex items-start gap-3">
        <img src={import.meta.env.BASE_URL + 'icons/icon-192.png'} alt="" width={44} height={44} className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <strong className="block text-[15px] leading-tight">Usar o Arcádia como app</strong>
          <p className="mt-1 text-[13px] leading-snug text-muted">Fica com ícone na tela inicial e abre em tela cheia, sem a barra do navegador.</p>
        </div>
        <button onClick={dismiss} aria-label="Fechar" title="Agora não" className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-fg">
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>
      <InstallAction className="mt-3 w-full" />
    </aside>
  );
}
