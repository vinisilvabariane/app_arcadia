/** minúsculas, sem acento, só letras e números */
export function norm(s: string): string {
  return String(s).toLowerCase().normalize('NFD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-z0-9]/g, '');
}

export function hash(s: string): number {
  let h = 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function rnd(n: number): number {
  return Math.floor(Math.random() * n);
}

export function fmtSize(bytes: number): string {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let b = bytes;
  let i = 0;
  while (b >= 1024 && i < u.length - 1) {
    b /= 1024;
    i++;
  }
  return (b < 10 && i ? b.toFixed(1).replace('.', ',') : Math.round(b)) + ' ' + u[i];
}

export function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function plural(n: number, one: string, many: string): string {
  return fmtNum(n) + ' ' + (n === 1 ? one : many);
}

export function fmtDate(t: number): string {
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Separa título, tags "(USA)" / "[!]" e extensão a partir do nome do arquivo. */
export function parseName(file: string, isFolder?: boolean) {
  const base = isFolder ? file : file.replace(/\.[a-z0-9]{1,5}$/i, '');
  const m = file.match(/\.([a-z0-9]{1,5})$/i);
  const ext = isFolder ? 'pasta' : m ? m[1].toLowerCase() : '';
  const tags: string[] = [];
  const re = /[([]([^)\]]+)[)\]]/g;
  let t: RegExpExecArray | null;
  while ((t = re.exec(base))) tags.push(t[1]);
  let title = base.replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || base;
  // "Legend of Zelda, The - ..." -> "The Legend of Zelda - ..."
  title = title.replace(/^(.+?), (The|A|An)( - |$)/, '$2 $1$3');
  return { base, ext, tags, title };
}

/** localStorage que nunca estoura erro (modo privado, sem espaço, etc.) */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sem acesso ou sem espaço: segue sem guardar */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ok */
    }
  },
};
