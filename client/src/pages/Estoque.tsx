import { useState } from 'react';
import { useApi } from '../dados';
import { Esqueleto, LinhasCarregando } from '../components/Carregando';
import { Link } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import Cabecalho from '../components/Cabecalho';
import { useAuth } from '../App';
import { api, qs } from '../api';
import { baixarCsv, dataHora, num } from '../format';
import type { Movimentacao, Produto } from '../types';
import Modal from '../components/Modal';
import Erro from '../components/Erro';
import SacDetalheModal from '../components/SacDetalheModal';

const TIPO: Record<Movimentacao['tipo'], string> = { ENTRADA_SAC: 'Entrada SAC', AJUSTE: 'Ajuste', ESTORNO: 'Estorno' };

export default function Estoque() {
  const [filtro, setFiltro] = useState('');
  // Um pedido só traz produtos e movimentações
  const { dados: painel } = useApi<{ produtos: Produto[]; movimentacoes: Movimentacao[] }>(`/estoque/painel${qs({ produto_id: filtro })}`);
  const { dados: painelGeral } = useApi<{ produtos: Produto[]; movimentacoes: Movimentacao[] }>(filtro ? '/estoque/painel' : null);
  const produtosD = painel?.produtos ?? painelGeral?.produtos;
  const movsD = painel?.movimentacoes;
  const produtos = produtosD ?? [];
  const movs = movsD ?? [];
  const [busca, setBusca] = useState('');
  const [ajuste, setAjuste] = useState<Produto | null>(null);
  const [estorno, setEstorno] = useState<Movimentacao | null>(null);
  const [sacAberto, setSacAberto] = useState<number | null>(null);

  const { lancarSac } = useAuth();

  const lista = produtos.filter((p) => !busca || `${p.codigo} ${p.descricao}`.toLowerCase().includes(busca.toLowerCase()));
  const tot = produtos.reduce((a, p) => ({ saldo: a.saldo + p.saldo, cam: a.cam + p.a_caminho, ind: a.ind + p.sem_definicao }), { saldo: 0, cam: 0, ind: 0 });

  return (
    <div className="pagina">
      <Cabecalho titulo="Estoque originado de SAC"
        descricao="Quantidade de material devolvido por situação."
        acoes={<button className="btn primario" onClick={lancarSac}><Plus size={18} /> Lançar SAC</button>} />

      <section className="fluxo" aria-label="Fluxo do material devolvido">
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
        <div className="etapa ok">
          <span className="etapa-rotulo"><span className="ponto ok" />Em estoque</span>
          <strong className="etapa-num">{produtosD ? num(tot.saldo) : <Esqueleto largura={44} />}</strong>
          <span className="etapa-sub">chegou e a nota foi lançada</span>
        </div>
      </section>

      <div className="cartao">
        <div className="barra-filtros">
          <h2>Produtos</h2>
          <input className="busca" placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="btn sec" onClick={() => baixarCsv('estoque-sac.csv',
            ['Código', 'Produto', 'Unidade', 'Em estoque', 'A caminho', 'Sem definição'],
            lista.map((p) => [p.codigo, p.descricao, p.unidade, p.saldo, p.a_caminho, p.sem_definicao]))}><Download size={16} /> Excel</button>
        </div>
        <table>
          <thead>
            <tr><th>Código</th><th>Produto</th><th>Unidade</th><th className="n">Em estoque</th><th className="n">A caminho</th><th className="n">Sem definição</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className={p.ativo ? '' : 'inativo'}>
                <td className="mono">{p.codigo}</td>
                <td>{p.descricao}</td>
                <td>{p.unidade}</td>
                <td className="n forte">{num(p.saldo)}</td>
                <td className="n">{num(p.a_caminho)}</td>
                <td className="n">{num(p.sem_definicao)}</td>
                <td className="acoes">
                  <button className="mini sec" onClick={() => setFiltro(String(p.id))}>Movimentações</button>
                  <button className="mini sec" onClick={() => setAjuste(p)}>Ajustar</button>
                </td>
              </tr>
            ))}
            {!produtosD && <LinhasCarregando colunas={7} linhas={1} />}
            {produtosD && !lista.length && <tr><td colSpan={7} className="vazio">Nenhum produto</td></tr>}
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

      {ajuste && <AjusteModal produto={ajuste} onFechar={() => setAjuste(null)} onFeito={() => setAjuste(null)} />}
      {estorno && <EstornoModal mov={estorno} onFechar={() => setEstorno(null)} onFeito={() => setEstorno(null)} />}
      {sacAberto && <SacDetalheModal id={sacAberto} onFechar={() => setSacAberto(null)} />}
    </div>
  );
}

function AjusteModal({ produto, onFechar, onFeito }: { produto: Produto; onFechar: () => void; onFeito: () => void }) {
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/estoque/ajuste', { body: { produto_id: produto.id, quantidade: qtd, motivo } }); onFeito(); }
    catch (err) { setErro((err as Error).message); }
  }
  return (
    <Modal titulo="Ajuste de estoque" onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <p className="resumo-sac">{produto.codigo} · {produto.descricao} · saldo atual <b>{num(produto.saldo)}</b></p>
        <label>Quantidade (use negativo para tirar, ex.: -2)
          <input autoFocus inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} required />
        </label>
        <label>Motivo do ajuste<textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} required placeholder="Ex.: contagem física, material descartado…" /></label>
        <Erro msg={erro} />
        <div className="botoes"><button type="button" className="sec" onClick={onFechar}>Voltar</button><button>Salvar ajuste</button></div>
      </form>
    </Modal>
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
