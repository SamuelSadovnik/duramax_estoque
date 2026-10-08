/*
 * Movimentações de um produto, numa consulta rápida.
 * Antes esse botão levava para outra tela e caía no topo dela, com a tabela
 * lá embaixo — a pessoa tinha que caçar. Aqui a resposta aparece por cima,
 * sem sair do lugar, e o Esc devolve para onde estava.
 */
import { useApi } from '../dados';
import { dataHora, num } from '../format';
import type { Movimentacao, Produto } from '../types';
import Modal from '../components/Modal';
import { Esqueleto } from './Carregando';

const TIPO: Record<Movimentacao['tipo'], string> = { ENTRADA_SAC: 'Entrada SAC', AJUSTE: 'Ajuste', ESTORNO: 'Estorno' };

export default function MovimentacoesModal({ produto, onFechar }: { produto: Produto; onFechar: () => void }) {
  const { dados } = useApi<{ produtos: Produto[]; movimentacoes: Movimentacao[] }>(`/estoque/painel?produto_id=${produto.id}`);
  const movs = dados?.movimentacoes;
  const atual = dados?.produtos.find((p) => p.id === produto.id) ?? produto;

  return (
    <Modal titulo="Movimentações do produto" onFechar={onFechar} largo>
      <div className="mov-topo">
        <div>
          <strong>{produto.descricao}</strong>
          <span className="mono suave">{produto.codigo} · {produto.unidade}</span>
        </div>
        <div className="mov-saldo">
          <span>Em estoque</span>
          <strong className={atual.saldo < 0 ? 'neg' : ''}>{num(atual.saldo)}</strong>
        </div>
      </div>

      {!movs && <div className="mov-lista"><Esqueleto largura={260} /><Esqueleto largura={200} /></div>}

      {movs && !movs.length && <p className="coluna-vazia">Esse produto ainda não teve movimentação.</p>}

      {!!movs?.length && (
        <ol className="mov-lista">
          {movs.map((m) => (
            <li key={m.id} className={m.estornada ? 'riscado' : ''}>
              <span className={`tag t-${m.tipo.toLowerCase()}`}>{TIPO[m.tipo]}</span>
              <div className="mov-info">
                <span className="mov-quando">{dataHora(m.data)}</span>
                <span className="mov-onde">
                  {[
                    m.nota && `NF ${m.nota}`,
                    m.sac_numero && `SAC #${m.sac_numero} · ${m.sac_cliente}`,
                    m.motivo,
                    m.usuario_nome,
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
              <strong className={`mov-qtd ${m.quantidade < 0 ? 'neg' : 'pos'}`}>
                {m.quantidade > 0 ? '+' : ''}{num(m.quantidade)}
              </strong>
              {!!m.estornada && <span className="mov-estornada">estornada</span>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
