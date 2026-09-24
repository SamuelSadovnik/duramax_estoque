const CHAVE = 'duramax-sac-token';

export function getToken(): string | null {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(CHAVE, t) : localStorage.removeItem(CHAVE); } catch { /* ignora */ }
}

export class ErroApi extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

let aoExpirar: () => void = () => {};
export function onSessaoExpirada(fn: () => void) { aoExpirar = fn; }

export async function api<T = unknown>(caminho: string, opcoes: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const r = await fetch(`/api${caminho}`, {
    method: opcoes.method ?? (opcoes.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && caminho !== '/login') aoExpirar();
    throw new ErroApi(r.status, dados.erro ?? `Erro ${r.status}`);
  }
  return dados as T;
}

/** Monta query string ignorando campos vazios */
export function qs(obj: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
