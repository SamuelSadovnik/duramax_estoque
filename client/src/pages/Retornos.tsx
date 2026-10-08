/*
 * Retornos de SAC: o material que ainda está voltando — sem definição ou a caminho —
 * e o histórico de movimentações. O saldo do que já chegou fica na tela de Estoque.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApi } from '../dados';
import { Esqueleto, LinhasCarregando } from '../components/Carregando';
import Cabecalho from '../components/Cabecalho';
import { useAuth } from '../App';
import { api, qs } from '../api';
import { dataHora, num } from '../format';
import type { Movimentacao, Produto } from '../types';
import Modal from '../components/Modal';
import Erro from '../components/Erro';
import SacDetalheModal from '../components/SacDetalheModal';

const TIPO: Record<Movimentacao['tipo'], string> = { ENTRADA_SAC: 'Entrada SAC', AJUSTE: 'Ajuste', ESTORNO: 'Estorno' };

export default function Retornos() {
  // O filtro vem na URL para a tela de Estoque conseguir apontar direto para um produto
  const [params, setParams] = useSearchParams();
  const filtro = params.get('produto') ?? '';
  const setFiltro = (v: string) => setParams(v ? { produto: v } : {}, { replace: true });

  const { dados: painel } = useApi<{ produtos: Produto[]; movimentacoes: Movimentacao[] }>(`/estoque/painel${qs({ produto_id: filtro })}`);
  const { dados: painelGeral } = useApi<{ produtos: Produto[]; movimentacoes: Movimentacao[] }>(filtro ? '/estoque/painel' : null);
  const produtosD = painel?.produtos ?? painelGeral?.produtos;
  const movsD = painel?.movimentacoes;
  const produtos = produtosD ?? [];
  const movs = movsD ?? [];
  const [estorno, setEstorno] = useState<Movimentacao | null>(null);
  const [sacAberto, setSacAberto] = useState<number | null>(null);
  const { lancarSac } = useAuth();

  // Só entra na lista quem ainda tem material voltando
  const voltando = produtos
    .filter((p) => p.sem_definicao !== 0 || p.a_caminho !== 0)
    .sort((a, b) => b.a_caminho + b.sem_definicao - (a.a_caminho + a.sem_definicao));
  const tot = produtos.reduce((a, p) => ({ cam: a.cam + p.a_caminho, ind: a.ind + p.sem_definicao }), { cam: 0, ind: 0 });

  return (
    <div className="pagina">
      <Cabecalho titulo="Retornos de SAC"
        descricao="Material devolvido que ainda não entrou no estoque."
        acoes={<button className="btn primario" onClick={lancarSac}><Plus size={18} /> Lançar SAC</button>} />

      <section className="fluxo" aria-label="Situação do material devolvido">
        <Link to="/sac/abertos" className="etapa ind">
          <span className="etapa-rotulo"><span className="ponto ind" />Sem definição</span>
          <strong className="etapa-num">{produtosD ? num(tot.ind) : <Esqueleto largura={44} />}</strong>
          <span className="etapa-sub">aguardando decisão se volta</span>
        </Link>
        <Link to="/sac/abertos" className="etapa cam">
          <span className="etapa-rotulo"><span className="ponto cam" />A caminho</span>
          <strong className="etapa-num">{produtosD ? num(tot.cam) : <Esqueleto largura={44} />}</strong>
          <span className="etapa-sub">vai voltar pra fábrica</span>
        </Link>
        <Link to="/estoque" className="etapa ok">
          <span className="etapa-rotulo"><span className="ponto ok" />Em estoque</span>
          <strong className="etapa-num">{produtosD ? num(produtos.reduce((a, p) => a + p.saldo, 0)) : <Esqueleto largura={44} />}</strong>
          <span className="etapa-sub">chegou e a nota foi lançada</span>
        </Link>
      </section>

      <div className="cartao">
        <div className="barra-filtros">
          <h2>Aguardando retorno</h2>
          <span className="suave">{produtosD ? `${voltando.length} ${voltando.length === 1 ? 'produto' : 'produtos'}` : ''}</span>
        </div>
        <table>
          <thead>
            <tr><th>Código</th><th>Produto</th><th>Unidade</th><th className="n">Sem definição</th><th className="n">A caminho</th><th></th></tr>
          </thead>
          <tbody>
            {voltando.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.codigo}</td>
                <td>{p.descricao}</td>
                <td>{p.unidade}</td>
                <td className="n">{p.sem_definicao ? num(p.sem_definicao) : <span className="suave">—</span>}</td>
                <td className="n">{p.a_caminho ? num(p.a_caminho) : <span className="suave">—</span>}</td>
                <td className="acoes"><button className="mini sec" onClick={() => setFiltro(String(p.id))}>Movimentações</button></td>
              </tr>
            ))}
            {!produtosD && <LinhasCarregando colunas={6} linhas={2} />}
            {produtosD && !voltando.length && <tr><td colSpan={6} className="vazio">Nada voltando no momento.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="cartao">
        <div className="barra-filtros">
          <h2>Movimentações</h2>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos os produtos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}
          </select>
        </div>
        <table>
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Produto</th><th className="n">Qtd</th><th>Nota</th><th>SAC</th><th>Motivo</th><th>Usuário</th><th></th></tr>
          </thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.id} className={m.estornada ? 'riscado' : ''}>
                <td className="mono suave">{dataHora(m.data)}</td>
                <td><span className={`tag t-${m.tipo.toLowerCase()}`}>{TIPO[m.tipo]}</span></td>
                <td className="mono">{m.produto_codigo}</td>
                <td className={`n forte ${m.quantidade < 0 ? 'neg' : 'pos'}`}>{m.quantidade > 0 ? '+' : ''}{num(m.quantidade)}</td>
                <td className="mono">{m.nota ?? '—'}</td>
                <td>{m.sac_numero ? <button className="link" onClick={() => setSacAberto(m.sac_id!)}>#{m.sac_numero} · {m.sac_cliente}</button> : '—'}</td>
                <td>{m.motivo ?? '—'}</td>
                <td>{m.usuario_nome}</td>
                <td className="acoes">
                  {m.tipo !== 'ESTORNO' && !m.estornada && <button className="mini sec" onClick={() => setEstorno(m)}>Estornar</button>}
                  {!!m.estornada && <small>estornada</small>}
                </td>
              </tr>
            ))}
            {!movsD && <LinhasCarregando colunas={9} />}
            {movsD && !movs.length && <tr><td colSpan={9} className="vazio">Nenhuma movimentação ainda</td></tr>}
          </tbody>
        </table>
      </div>

      {estorno && <EstornoModal mov={estorno} onFechar={() => setEstorno(null)} onFeito={() => setEstorno(null)} />}
      {sacAberto && <SacDetalheModal id={sacAberto} onFechar={() => setSacAberto(null)} />}
    </div>
  );
}

function EstornoModal({ mov, onFechar, onFeito }: { mov: Movimentacao; onFechar: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try { await api(`/estoque/movimentacoes/${mov.id}/estornar`, { body: { motivo } }); onFeito(); }
    catch (err) { setErro((err as Error).message); }
  }
  return (
    <Modal titulo="Estornar movimentação" onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <p className="resumo-sac">{TIPO[mov.tipo]} de <b>{mov.quantidade > 0 ? '+' : ''}{num(mov.quantidade)}</b> em {dataHora(mov.data)}{mov.nota ? ` · NF ${mov.nota}` : ''}</p>
        {mov.tipo === 'ENTRADA_SAC' && <div className="alerta aviso">O SAC #{mov.sac_numero} volta para "a caminho" (aguardando material).</div>}
        <label>Motivo do estorno<textarea autoFocus rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ex.: nota lançada errada" /></label>
        <Erro msg={erro} />
        <div className="botoes"><button type="button" className="sec" onClick={onFechar}>Voltar</button><button className="perigo">Estornar</button></div>
      </form>
    </Modal>
  );
}
