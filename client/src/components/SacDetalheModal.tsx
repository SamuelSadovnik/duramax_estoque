import { useEffect, useState } from 'react';
import { api } from '../api';
import { dataHora, data, num } from '../format';
import type { SacDetalhe } from '../types';
import Modal from './Modal';
import StatusBadge from './StatusBadge';

export default function SacDetalheModal({ id, onFechar }: { id: number; onFechar: () => void }) {
  const [sac, setSac] = useState<SacDetalhe | null>(null);
  useEffect(() => { api<SacDetalhe>(`/sacs/${id}`).then(setSac); }, [id]);

  return (
    <Modal titulo={sac ? `SAC #${sac.numero}` : 'SAC'} onFechar={onFechar} largo>
      {!sac ? 'Carregando…' : (
        <>
          <div className="detalhe-grid">
            <div><span>Status</span><StatusBadge status={sac.status} /></div>
            <div><span>Cliente</span>{sac.cliente}</div>
            <div><span>Produto</span>{sac.produto_codigo} · {sac.produto_descricao}</div>
            <div><span>Quantidade</span>{num(sac.quantidade)} {sac.produto_unidade}</div>
            <div><span>Motivos</span>{sac.motivos}</div>
            <div><span>NF de venda</span>{sac.nf_venda ?? '—'}</div>
            <div><span>Volta pra fábrica?</span>{sac.volta_fabrica == null ? 'Sem definição' : sac.volta_fabrica ? 'Sim' : 'Não'}</div>
            {sac.nf_entrada && <div><span>NF de entrada</span>{sac.nf_entrada} · {num(sac.qtd_recebida)} em {data(sac.data_entrada)}</div>}
            {sac.resolucao && <div className="larg"><span>{sac.status === 'CANCELADO' ? 'Motivo do cancelamento' : 'O que aconteceu'}</span>{sac.resolucao}</div>}
            {sac.observacao && <div className="larg"><span>Observação</span>{sac.observacao}</div>}
            <div><span>Aberto em</span>{dataHora(sac.data_abertura)} por {sac.criado_por_nome}</div>
            <div><span>Última modificação</span>{dataHora(sac.data_modificacao)}</div>
            <div><span>Concluído em</span>{dataHora(sac.data_conclusao)}</div>
            <div><span>Dias</span>{sac.dias}</div>
          </div>
          <h3>Histórico</h3>
          <ol className="linha-tempo">
            {sac.logs.map((l) => (
              <li key={l.id}>
                <time>{dataHora(l.data)}</time>
                <b>{l.acao}</b> <span className="quem">· {l.usuario_nome}</span>
                {l.detalhes && <div className="det">{l.detalhes}</div>}
              </li>
            ))}
          </ol>
        </>
      )}
    </Modal>
  );
}
