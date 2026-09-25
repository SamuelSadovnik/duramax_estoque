// A sessão fica num cookie HttpOnly (o JavaScript da página não consegue ler o token).
export class ErroApi extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

let aoExpirar: () => void = () => {};
export function onSessaoExpirada(fn: () => void) { aoExpirar = fn; }

export async function api<T = unknown>(caminho: string, opcoes: { method?: string; body?: unknown } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${caminho}`, {
      method: opcoes.method ?? (opcoes.body ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'duramax' },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && caminho !== '/login' && caminho !== '/me') aoExpirar();
    throw new ErroApi(r.status, dados.erro ?? `Erro ${r.status}`);
  }
  if (r.ok && (opcoes.method ?? (opcoes.body ? 'POST' : 'GET')) !== 'GET' && !['/login', '/logout'].includes(caminho))
    window.dispatchEvent(new Event('dados-alterados'));
  return dados as T;
}

/** Monta query string ignorando campos vazios */
export function qs(obj: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
