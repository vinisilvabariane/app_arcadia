import { create } from 'zustand';

/* Instalar o site como app (tela inicial do celular, ou janela própria no PC).

   - Chrome, Edge e Samsung Internet avisam quando o site pode ser instalado (evento
     "beforeinstallprompt"). A gente guarda o aviso e mostra o nosso próprio botão.
   - O Safari do iPhone/iPad não tem esse aviso: lá a pessoa instala pelo menu Compartilhar,
     então o site só explica o caminho. */

/** o aviso do navegador; ainda não existe nos tipos do TypeScript */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'arc-instalar-fechado';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

// iPad novo se apresenta como Mac; a diferença é a tela de toque
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

interface InstallState {
  /** o navegador ofereceu a instalação: dá pra abrir a janela dele pelo nosso botão */
  canPrompt: boolean;
  /** iPhone/iPad: instala pelo menu Compartilhar */
  ios: boolean;
  /** já está aberto como app */
  standalone: boolean;
  /** a pessoa fechou o convite */
  dismissed: boolean;
  install: () => Promise<boolean>;
  dismiss: () => void;
}

let pending: InstallEvent | null = null;

export const useInstall = create<InstallState>((set) => ({
  canPrompt: false,
  ios: isIos(),
  standalone: isStandalone(),
  dismissed: wasDismissed(),

  /** abre a janela de instalação do navegador; devolve se a pessoa aceitou */
  install: async () => {
    const event = pending;
    if (!event) return false;
    // o aviso só pode ser usado uma vez
    pending = null;
    set({ canPrompt: false });
    await event.prompt();
    return (await event.userChoice).outcome === 'accepted';
  },

  dismiss: () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sem localStorage: só fecha nesta visita */
    }
    set({ dismissed: true });
  },
}));

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // segura a barrinha padrão do Chrome: quem convida é o site
  pending = e as InstallEvent;
  useInstall.setState({ canPrompt: true });
});

window.addEventListener('appinstalled', () => {
  pending = null;
  useInstall.setState({ canPrompt: false, standalone: true });
});

/** Dá pra mostrar alguma opção de instalar? (não, se já está como app) */
export const installAvailable = (s: InstallState) => !s.standalone && (s.canPrompt || s.ios);
