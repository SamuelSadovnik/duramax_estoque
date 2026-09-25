import { useEffect, useState } from 'react';
import { api, qs } from '../api';
import { baixarCsv, dataHora } from '../format';
import type { Log } from '../types';
import { Download } from 'lucide-react';
import SacDetalheModal from '../components/SacDetalheModal';
import Cabecalho from '../components/Cabecalho';

const ENT: Record<string, string> = { sac: 'SAC', produto: 'Produto / estoque', usuario: 'Usuário', motivo: 'Motivo' };

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [f, setF] = useState({ entidade: '', texto: '', de: '', ate: '' });
  const [detalhe, setDetalhe] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => api<Log[]>(`/logs${qs(f)}`).then(setLogs), 250);
    return () => clearTimeout(t);
  }, [f]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="pagina">
      <Cabecalho sobre="Controle" titulo="Histórico" descricao="Tudo o que foi feito no sistema, por quem e quando."
        acoes={<button className="btn sec" onClick={() => baixarCsv('logs.csv', ['Data', 'Usuário', 'Área', 'ID', 'Ação', 'Detalhes'],
          logs.map((l) => [dataHora(l.data), l.usuario_nome, ENT[l.entidade] ?? l.entidade, l.entidade_id, l.acao, l.detalhes]))}><Download size={16} /> Exportar Excel</button>} />
      <div className="cartao">
        <div className="barra-filtros">
          <select value={f.entidade} onChange={set('entidade')}>
            <option value="">Todas as áreas</option>
            {Object.entries(ENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder="Buscar (ação, detalhe, usuário)" value={f.texto} onChange={set('texto')} />
          <label className="inline">De <input type="date" value={f.de} onChange={set('de')} /></label>
          <label className="inline">até <input type="date" value={f.ate} onChange={set('ate')} /></label>
        </div>
        <table>
          <thead><tr><th>Data e hora</th><th>Usuário</th><th>Área</th><th>Ação</th><th>Detalhes</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="nowrap mono suave">{dataHora(l.data)}</td>
                <td>{l.usuario_nome ?? '—'}</td>
                <td>{l.entidade === 'sac' && l.entidade_id
                  ? <button className="link" onClick={() => setDetalhe(l.entidade_id!)}>SAC (abrir)</button>
                  : ENT[l.entidade] ?? l.entidade}</td>
                <td>{l.acao}</td>
                <td>{l.detalhes}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan={5} className="vazio">Nenhum registro</td></tr>}
          </tbody>
        </table>
      </div>
      {detalhe && <SacDetalheModal id={detalhe} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}
