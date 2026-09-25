import { useEffect, useState } from 'react';
import { api, qs } from '../api';
import { baixarCsv, data, dataHora, num } from '../format';
import { STATUS_LABEL, type Motivo, type Produto, type Sac } from '../types';
import { Download } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Cabecalho from '../components/Cabecalho';
import SacDetalheModal from '../components/SacDetalheModal';

export default function SacsResolvidos() {
  const [sacs, setSacs] = useState<Sac[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [f, setF] = useState({ status: '', cliente: '', produto_id: '', motivo_id: '', de: '', ate: '' });
  const [detalhe, setDetalhe] = useState<number | null>(null);

  useEffect(() => {
    api<Produto[]>('/produtos').then(setProdutos);
    api<Motivo[]>('/motivos').then(setMotivos);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => api<Sac[]>(`/sacs${qs({ grupo: 'resolvidos', ...f })}`).then(setSacs), 250);
    return () => clearTimeout(t);
  }, [f]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const recebido = sacs.filter((s) => s.status === 'RECEBIDO').reduce((a, s) => a + (s.qtd_recebida ?? 0), 0);

  function exportar() {
    baixarCsv('sacs-resolvidos.csv',
      ['SAC', 'Status', 'Cliente', 'Código', 'Produto', 'Qtd SAC', 'Motivos', 'NF venda', 'Volta fábrica', 'NF entrada', 'Qtd recebida',
        'Data entrada', 'O que aconteceu', 'Abertura', 'Conclusão', 'Dias', 'Aberto por'],
      sacs.map((s) => [s.numero, STATUS_LABEL[s.status], s.cliente, s.produto_codigo, s.produto_descricao, s.quantidade, s.motivos,
        s.nf_venda, s.volta_fabrica == null ? '' : s.volta_fabrica ? 'Sim' : 'Não', s.nf_entrada, s.qtd_recebida, data(s.data_entrada),
        s.resolucao, dataHora(s.data_abertura), dataHora(s.data_conclusao), s.dias, s.criado_por_nome]));
  }

  return (
    <div className="pagina">
      <Cabecalho titulo="SACs resolvidos" descricao="SACs que chegaram na fábrica, foram resolvidos sem retorno ou cancelados."
        acoes={<button className="btn sec" onClick={exportar}><Download size={16} /> Exportar Excel</button>} />
      <div className="cartao">
        <div className="barra-filtros">
          <select value={f.status} onChange={set('status')}>
            <option value="">Todos os status</option>
            <option value="RECEBIDO">Recebido na fábrica</option>
            <option value="SEM_RETORNO">Resolvido sem retorno</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <input placeholder="Cliente" value={f.cliente} onChange={set('cliente')} />
          <select value={f.produto_id} onChange={set('produto_id')}>
            <option value="">Todos os produtos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}
          </select>
          <select value={f.motivo_id} onChange={set('motivo_id')}>
            <option value="">Todos os motivos</option>
            {motivos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <label className="inline">Concluído de <input type="date" value={f.de} onChange={set('de')} /></label>
          <label className="inline">até <input type="date" value={f.ate} onChange={set('ate')} /></label>
        </div>
        <p className="ajuda">{sacs.length} SAC(s) · {num(recebido)} unidade(s) recebidas na fábrica neste filtro</p>
        <table>
          <thead>
            <tr><th>SAC</th><th>Status</th><th>Cliente</th><th>Produto</th><th className="n">Qtd</th><th>Motivo</th><th>Entrada / o que aconteceu</th><th>Abertura</th><th>Conclusão</th><th className="n">Dias</th></tr>
          </thead>
          <tbody>
            {sacs.map((s) => (
              <tr key={s.id} className="clicavel" onClick={() => setDetalhe(s.id)}>
                <td className="mono">#{s.numero}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>{s.cliente}</td>
                <td>{s.produto_descricao}</td>
                <td className="n">{num(s.quantidade)}</td>
                <td>{s.motivos}</td>
                <td>{s.status === 'RECEBIDO' ? `NF ${s.nf_entrada} · ${num(s.qtd_recebida)} recebidos` : s.resolucao}</td>
                <td>{data(s.data_abertura)}</td>
                <td>{data(s.data_conclusao)}</td>
                <td className="n">{s.dias}</td>
              </tr>
            ))}
            {!sacs.length && <tr><td colSpan={10} className="vazio">Nenhum SAC resolvido nesse filtro</td></tr>}
          </tbody>
        </table>
      </div>
      {detalhe && <SacDetalheModal id={detalhe} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}
