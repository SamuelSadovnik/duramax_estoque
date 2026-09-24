/** "2026-09-24 14:32:10" → "24/09/2026 14:32" */
export function dataHora(s: string | null | undefined): string {
  if (!s) return '—';
  const [d, h] = s.split(' ');
  const [a, m, di] = d.split('-');
  return `${di}/${m}/${a}${h ? ' ' + h.slice(0, 5) : ''}`;
}
export function data(s: string | null | undefined): string {
  if (!s) return '—';
  return dataHora(s.split(' ')[0]);
}
export function num(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
export function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Baixa um CSV (separador ;) que abre direto no Excel */
export function baixarCsv(nome: string, cabecalho: string[], linhas: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}
