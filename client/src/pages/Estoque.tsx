/*
 * Estoque: o saldo de cada produto que já entrou na fábrica.
 * O que ainda está voltando (sem definição, a caminho) e o histórico de
 * movimentações ficam na tela de Retornos de SAC — aqui é só o que existe hoje.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useApi } from '../dados';
import { LinhasCarregando } from '../components/Carregando';
import Cabecalho from '../components/Cabecalho';
import { api } from '../api';
import { baixarCsv, num } from '../format';
import type { Movimentacao, Produto } from '../types';
import Modal from '../components/Modal';
import Erro from '../components/Erro';
import MovimentacoesModal from '../components/MovimentacoesModal';

export default function Estoque() {
  const { dados: painel } = useApi<{ produtos: Produto[]; movimentacoes: Movimentacao[] }>('/estoque/painel');
  const produtosD = painel?.produtos;
  const produtos = produtosD ?? [];
  const [busca, setBusca] = useState('');
  const [soComSaldo, setSoComSaldo] = useState(true);
  const [ajuste, setAjuste] = useState<Produto | null>(null);
  const [movendo, setMovendo] = useState<Produto | null>(null);

  const lista = produtos
    .filter((p) => !busca || `${p.codigo} ${p.descricao}`.toLowerCase().includes(busca.toLowerCase()))
    .filter((p) => !soComSaldo || p.saldo !== 0)
    .sort((a, b) => b.saldo - a.saldo || a.descricao.localeCompare(b.descricao));
  const total = produtos.reduce((a, p) => a + p.saldo, 0);
  const comSaldo = produtos.filter((p) => p.saldo !== 0).length;

  return (
    <div className="pagina">
      <Cabecalho titulo="Estoque"
        descricao="Saldo de cada produto que já chegou na fábrica e teve a nota lançada." />

      <section className="resumo-estoque">
        <div>
          <span>Em estoque</span>
          <strong>{produtosD ? num(total) : '—'}</strong>
        </div>
        <div>
          <span>Produtos com saldo</span>
          <strong>{produtosD ? num(comSaldo) : '—'}</strong>
        </div>
        <p className="ajuda">
          Material que ainda está voltando aparece em <Link to="/">Retornos de SAC</Link>.
        </p>
      </section>

      <div className="cartao">
        <div className="barra-filtros">
          <h2>Produtos</h2>
          <input className="busca" placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="chips">
            <button className={`chip ${soComSaldo ? 'on' : ''}`} onClick={() => setSoComSaldo(true)}>Com saldo</button>
            <button className={`chip ${soComSaldo ? '' : 'on'}`} onClick={() => setSoComSaldo(false)}>Todos</button>
          </div>
          <button className="btn sec" onClick={() => baixarCsv('estoque.csv',
            ['Código', 'Produto', 'Unidade', 'Em estoque'],
            lista.map((p) => [p.codigo, p.descricao, p.unidade, p.saldo]))}><Download size={16} /> Excel</button>
        </div>
        <table>
          <thead>
            <tr><th>Código</th><th>Produto</th><th>Unidade</th><th className="n">Em estoque</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className={p.ativo ? '' : 'inativo'}>
                <td className="mono">{p.codigo}</td>
                <td>{p.descricao}</td>
                <td>{p.unidade}</td>
                <td className={`n forte ${p.saldo < 0 ? 'neg' : ''}`} title={p.saldo < 0 ? 'Saiu mais do que entrou: confira as movimentações' : undefined}>{num(p.saldo)}</td>
                <td className="acoes">
                  <button className="mini sec" onClick={() => setMovendo(p)}>Movimentações</button>
                  <button className="mini sec" onClick={() => setAjuste(p)}>Ajustar</button>
                </td>
              </tr>
            ))}
            {!produtosD && <LinhasCarregando colunas={5} linhas={3} />}
            {produtosD && !lista.length && (
              <tr><td colSpan={5} className="vazio">
                {busca ? `Nenhum produto para "${busca}".` : soComSaldo ? 'Nenhum produto com saldo. Veja "Todos".' : 'Nenhum produto cadastrado.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {ajuste && <AjusteModal produto={ajuste} onFechar={() => setAjuste(null)} onFeito={() => setAjuste(null)} />}
      {movendo && <MovimentacoesModal produto={movendo} onFechar={() => setMovendo(null)} />}
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
