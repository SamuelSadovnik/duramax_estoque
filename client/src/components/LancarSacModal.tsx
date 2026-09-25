import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import { useApi } from '../dados';
import { api } from '../api';
import { num } from '../format';
import type { Motivo, Produto, Sac } from '../types';
import { CircleHelp, CircleX, Truck, CheckCircle2 } from 'lucide-react';
import Erro from './Erro';

type Volta = 'sim' | 'nao' | 'indefinido';

/** Janela de lançamento de SAC (abre por cima da tela atual) */
export default function LancarSacModal({ onFechar }: { onFechar: () => void }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [clientes, setClientes] = useState<string[]>([]);
  const [cliente, setCliente] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [motivoIds, setMotivoIds] = useState<number[]>([]);
  const [volta, setVolta] = useState<Volta | null>(null);
  const [resolucao, setResolucao] = useState('');
  const [nfVenda, setNfVenda] = useState('');
  const [obs, setObs] = useState('');
  const [mais, setMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<Sac | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Usa o que já está em cache (abre na hora) e atualiza por trás
  const produtosD = useApi<Produto[]>('/produtos').dados;
  const motivosD = useApi<Motivo[]>('/motivos').dados;
  const clientesD = useApi<string[]>('/clientes').dados;
  useEffect(() => {
    if (!produtosD) return;
    const ativos = produtosD.filter((p) => p.ativo);
    setProdutos(ativos);
    if (ativos.length === 1) setProdutoId((atual) => atual || String(ativos[0].id));
  }, [produtosD]);
  useEffect(() => { if (motivosD) setMotivos(motivosD.filter((m) => m.ativo)); }, [motivosD]);
  useEffect(() => { if (clientesD) setClientes(clientesD); }, [clientesD]);

  const produto = useMemo(() => produtos.find((p) => String(p.id) === produtoId), [produtos, produtoId]);
  const alternar = (id: number) => setMotivoIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  function limpar() {
    setCliente(''); setQuantidade(''); setMotivoIds([]); setVolta(null); setResolucao('');
    setNfVenda(''); setObs(''); setMais(false); setSalvo(null); setErro(null);
    if (produtos.length !== 1) setProdutoId('');
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!motivoIds.length) return setErro('Escolha pelo menos um motivo.');
    if (!volta) return setErro('Responda se o material vai voltar pra fábrica.');
    setSalvando(true);
    try {
      const s = await api<Sac>('/sacs', {
        body: { cliente, produto_id: Number(produtoId), quantidade, motivo_ids: motivoIds, volta, resolucao, nf_venda: nfVenda, observacao: obs },
      });
      setSalvo(s);
      setClientes((c) => (c.includes(s.cliente) ? c : [...c, s.cliente].sort()));
    } catch (err) { setErro((err as Error).message); } finally { setSalvando(false); }
  }

  if (salvo) {
    const msg = salvo.status === 'AGUARDANDO'
      ? `Ficou como "a caminho". Quando o material chegar, dê entrada em SACs em aberto.`
      : salvo.status === 'SEM_RETORNO'
        ? 'SAC concluído sem retorno. O estoque não foi alterado.'
        : 'Ficou como "sem definição". Decida depois em SACs em aberto se volta ou não.';
    return (
      <Modal titulo="Lançar SAC" onFechar={onFechar}>
        <div className="sucesso">
          <CheckCircle2 className="sucesso-icone" size={36} />
          <h2>SAC <span className="mono">#{salvo.numero}</span> lançado</h2>
          <p>{salvo.cliente} · {num(salvo.quantidade)} × {salvo.produto_descricao}</p>
          <p>{msg}</p>
          <div className="botoes">
            <Link className="btn sec" to="/sac/abertos" onClick={onFechar}>Ver SACs em aberto</Link>
            <button className="btn sec" onClick={limpar}>Lançar outro</button>
            <button className="btn primario" autoFocus onClick={onFechar}>Fechar</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo="Lançar SAC" onFechar={onFechar} largo>
      <form className="form" onSubmit={salvar}>
        <label>Cliente
          <input list="lista-clientes" autoFocus value={cliente} onChange={(e) => setCliente(e.target.value)}
            placeholder="Ex.: LM TINTAS" required />
          <datalist id="lista-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
        </label>

        <div className="linha-2 prod">
          <label>Produto
            <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} required>
              <option value="">Selecione…</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descricao}</option>)}
            </select>
          </label>
          <label>Quantidade{produto ? ` (${produto.unidade})` : ''}
            <input inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="30" required />
          </label>
        </div>

        <fieldset>
          <legend>Motivo</legend>
          <div className="chips">
            {motivos.map((m) => (
              <button type="button" key={m.id} className={`chip ${motivoIds.includes(m.id) ? 'on' : ''}`} onClick={() => alternar(m.id)}>
                {m.nome}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Vai voltar pra fábrica?</legend>
          <div className="opcoes-volta">
            <button type="button" className={`opcao ${volta === 'sim' ? 'on sim' : ''}`} onClick={() => setVolta('sim')}>
              <Truck size={22} /><b>Sim, vai voltar</b><small>Fica “a caminho” e entra no estoque quando chegar</small>
            </button>
            <button type="button" className={`opcao ${volta === 'nao' ? 'on nao' : ''}`} onClick={() => setVolta('nao')}>
              <CircleX size={22} /><b>Não volta</b><small>Resolve agora, sem mexer no estoque</small>
            </button>
            <button type="button" className={`opcao ${volta === 'indefinido' ? 'on ind' : ''}`} onClick={() => setVolta('indefinido')}>
              <CircleHelp size={22} /><b>Ainda não sei</b><small>Fica “sem definição” pra decidir depois</small>
            </button>
          </div>
        </fieldset>

        {volta === 'nao' && (
          <label>O que aconteceu com o produto?
            <textarea rows={2} value={resolucao} onChange={(e) => setResolucao(e.target.value)} required
              placeholder="Ex.: descartado no cliente, gerado crédito…" />
          </label>
        )}

        {!mais ? (
          <button type="button" className="link" onClick={() => setMais(true)}>+ NF de venda e observação (opcional)</button>
        ) : (
          <>
            <label>NF de venda (opcional)<input value={nfVenda} onChange={(e) => setNfVenda(e.target.value)} /></label>
            <label>Observação (opcional)<textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></label>
          </>
        )}

        <Erro msg={erro} />
        <div className="botoes">
          <button type="button" className="btn sec" onClick={onFechar}>Cancelar</button>
          <button className="btn primario grande" disabled={salvando}>{salvando ? 'Lançando…' : 'Lançar SAC'}</button>
        </div>
      </form>
    </Modal>
  );
}
