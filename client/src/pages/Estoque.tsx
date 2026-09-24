import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { baixarCsv, dataHora, num } from '../format';
import type { Movimentacao, Produto } from '../types';
import Modal from '../components/Modal';
import Erro from '../components/Erro';
import SacDetalheModal from '../components/SacDetalheModal';

const TIPO: Record<Movimentacao['tipo'], string> = { ENTRADA_SAC: 'Entrada SAC', AJUSTE: 'Ajuste', ESTORNO: 'Estorno' };

export default function Estoque() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [ajuste, setAjuste] = useState<Produto | null>(null);
  const [estorno, setEstorno] = useState<Movimentacao | null>(null);
  const [sacAberto, setSacAberto] = useState<number | null>(null);

  const carregar = useCallback(() => {
    api<Produto[]>('/produtos').then(setProdutos);
    api<Movimentacao[]>(`/estoque/movimentacoes${qs({ produto_id: filtro })}`).then(setMovs);
  }, [filtro]);
  useEffect(carregar, [carregar]);

  const lista = produtos.filter((p) => !busca || `${p.codigo} ${p.descricao}`.toLowerCase().includes(busca.toLowerCase()));
  const tot = produtos.reduce((a, p) => ({ saldo: a.saldo + p.saldo, cam: a.cam + p.a_caminho, ind: a.ind + p.sem_definicao }), { saldo: 0, cam: 0, ind: 0 });

  return (
    <div className="pagina">
      <div className="topo">
        <h1>Estoque originado de SAC</h1>
        <Link to="/sac/novo" className="botao">+ Lançar SAC</Link>
      </div>

      <div className="kpis">
        <div className="kpi"><span>Em estoque</span><strong>{num(tot.saldo)}</strong><small>já chegou na fábrica</small></div>
        <div className="kpi cam"><span>A caminho</span><strong>{num(tot.cam)}</strong><small>vai voltar, ainda não chegou</small></div>
        <div className="kpi ind"><span>Sem definição</span><strong>{num(tot.ind)}</strong><small>não decidido se volta</small></div>
      </div>

      <div className="cartao">
        <div className="barra-filtros">
          <input placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="sec" onClick={() => baixarCsv('estoque-sac.csv',
            ['Código', 'Produto', 'Unidade', 'Em estoque', 'A caminho', 'Sem definição'],
            lista.map((p) => [p.codigo, p.descricao, p.unidade, p.saldo, p.a_caminho, p.sem_definicao]))}>Exportar Excel</button>
        </div>
        <table>
          <thead>
            <tr><th>Código</th><th>Produto</th><th>Unidade</th><th className="n">Em estoque</th><th className="n">A caminho</th><th className="n">Sem definição</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className={p.ativo ? '' : 'inativo'}>
                <td>{p.codigo}</td>
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
            {!lista.length && <tr><td colSpan={7} className="vazio">Nenhum produto</td></tr>}
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
                <td>{dataHora(m.data)}</td>
                <td><span className={`tag t-${m.tipo.toLowerCase()}`}>{TIPO[m.tipo]}</span></td>
                <td>{m.produto_codigo}</td>
                <td className={`n forte ${m.quantidade < 0 ? 'neg' : 'pos'}`}>{m.quantidade > 0 ? '+' : ''}{num(m.quantidade)}</td>
                <td>{m.nota ?? '—'}</td>
                <td>{m.sac_numero ? <button className="link" onClick={() => setSacAberto(m.sac_id!)}>#{m.sac_numero} · {m.sac_cliente}</button> : '—'}</td>
                <td>{m.motivo ?? '—'}</td>
                <td>{m.usuario_nome}</td>
                <td className="acoes">
                  {m.tipo !== 'ESTORNO' && !m.estornada && <button className="mini sec" onClick={() => setEstorno(m)}>Estornar</button>}
                  {!!m.estornada && <small>estornada</small>}
                </td>
              </tr>
            ))}
            {!movs.length && <tr><td colSpan={9} className="vazio">Nenhuma movimentação ainda</td></tr>}
          </tbody>
        </table>
      </div>

      {ajuste && <AjusteModal produto={ajuste} onFechar={() => setAjuste(null)} onFeito={() => { setAjuste(null); carregar(); }} />}
      {estorno && <EstornoModal mov={estorno} onFechar={() => setEstorno(null)} onFeito={() => { setEstorno(null); carregar(); }} />}
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
