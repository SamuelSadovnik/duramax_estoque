import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/*
 * Cache simples dos dados já carregados (fica só na memória desta aba).
 * Ao voltar numa tela, ela aparece na hora com o que já tinha e atualiza por trás.
 */
const cache = new Map<string, unknown>();
const EVENTO = 'dados-alterados';

/** Avisa todas as telas abertas que algo mudou (chamado depois de salvar qualquer coisa) */
export function avisarAlteracao() {
  window.dispatchEvent(new Event(EVENTO));
}
export function limparCache() { cache.clear(); }
/** Busca antes de a pessoa abrir a tela */
export function preCarregar(...caminhos: string[]) {
  for (const c of caminhos) if (!cache.has(c)) api(c).then((d) => cache.set(c, d)).catch(() => {});
}

export function useApi<T>(caminho: string | null) {
  const [dados, setDados] = useState<T | undefined>(() => (caminho ? (cache.get(caminho) as T | undefined) : undefined));
  const [erro, setErro] = useState<string | null>(null);
  const atual = useRef(caminho);
  atual.current = caminho;

  const recarregar = useCallback(async () => {
    if (!caminho) return;
    try {
      const d = await api<T>(caminho);
      cache.set(caminho, d);
      if (atual.current === caminho) { setDados(d); setErro(null); }
    } catch (e) {
      if (atual.current === caminho) setErro((e as Error).message);
    }
  }, [caminho]);

  useEffect(() => {
    if (caminho && cache.has(caminho)) setDados(cache.get(caminho) as T);
    recarregar();
  }, [caminho, recarregar]);

  useEffect(() => {
    window.addEventListener(EVENTO, recarregar);
    return () => window.removeEventListener(EVENTO, recarregar);
  }, [recarregar]);

  return { dados, carregando: dados === undefined && !erro, erro, recarregar };
}

/** Atraso para filtros digitados (não busca a cada tecla) */
export function useAtrasado<T>(valor: T, ms = 250): T {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}
