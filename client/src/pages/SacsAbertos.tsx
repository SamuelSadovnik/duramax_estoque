import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Cabecalho from '../components/Cabecalho';
import { api } from '../api';
import { data, num } from '../format';
import type { Sac } from '../types';
import AcoesSac from '../components/AcoesSac';
import SacDetalheModal from '../components/SacDetalheModal';

type Acao = 'chegou' | 'nao-volta' | 'cancelar';

export default function SacsAbertos() {
  const [sacs, setSacs] = useState<Sac[]>([]);
  const [busca, setBusca] = useState('');
  const [acao, setAcao] = useState<{ sac: Sac; tipo: Acao } | null>(null);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(() => { api<Sac[]>('/sacs?grupo=abertos').then(setSacs); }, []);
  useEffect(carregar, [carregar]);

  const filtrar = (s: Sac) => !busca || `${s.numero} ${s.cliente} ${s.produto_descricao}`.toLowerCase().includes(busca.toLowerCase());
  const aCaminho = sacs.filter((s) => s.status === 'AGUARDANDO' && filtrar(s));
  const semDef = sacs.filter((s) => s.status === 'ABERTO' && filtrar(s));

  async function vaiVoltar(s: Sac) {
    await api(`/sacs/${s.id}/volta`, { method: 'POST' });
    setAviso(`SAC #${s.numero} marcado como "a caminho".`);
    carregar();
  }
  const feito = (msg: string) => { setAcao(null); setAviso(msg); carregar(); };

  const linha = (s: Sac, botoes: React.ReactNode) => (
    <tr key={s.id}>
      <td><button className="link mono" onClick={() => setDetalhe(s.id)}>#{s.numero}</button></td>
      <td className="mono suave">{data(s.data_abertura)}</td>
      <td>{s.cliente}</td>
      <td>{s.produto_descricao}</td>
      <td className="n forte">{num(s.quantidade)}</td>
      <td>{s.motivos}</td>
      <td className="n">{s.dias}</td>
      <td className="acoes">{botoes}</td>
    </tr>
  );
  const cab = (
    <thead><tr><th>SAC</th><th>Aberto em</th><th>Cliente</th><th>Produto</th><th className="n">Qtd</th><th>Motivo</th><th className="n">Dias</th><th></th></tr></thead>
  );

  return (
    <div className="pagina">
      <Cabecalho sobre="Acompanhamento" titulo="SACs em aberto"
        descricao="Material que ainda não chegou ou que ainda não se sabe se volta."
        acoes={<>
          <input className="busca" placeholder="Buscar SAC, cliente ou produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Link to="/sac/novo" className="btn primario"><Plus size={18} /> Lançar SAC</Link>
        </>} />
      {aviso && <div className="alerta ok" onClick={() => setAviso(null)}>{aviso}</div>}

      <div className="cartao">
        <h2><span className="ponto cam" />A caminho da fábrica <span className="contador">{aCaminho.length}</span></h2>
        <p className="ajuda">Material que vai voltar. Quando chegar, clique em <b>Chegou</b> e informe a nota. O estoque sobe na hora.</p>
        <table>
          {cab}
          <tbody>
            {aCaminho.map((s) => linha(s, <>
              <button className="btn mini primario" onClick={() => setAcao({ sac: s, tipo: 'chegou' })}>Chegou</button>
              <button className="btn mini sec" onClick={() => setAcao({ sac: s, tipo: 'nao-volta' })}>Não vai voltar</button>
              <button className="btn mini fantasma" onClick={() => setAcao({ sac: s, tipo: 'cancelar' })}>Cancelar</button>
            </>))}
            {!aCaminho.length && <tr><td colSpan={8} className="vazio">Nenhum material a caminho</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="cartao">
        <h2><span className="ponto ind" />Sem definição <span className="contador">{semDef.length}</span></h2>
        <p className="ajuda">Ainda não se sabe se o material volta pra fábrica.</p>
        <table>
          {cab}
          <tbody>
            {semDef.map((s) => linha(s, <>
              <button className="btn mini primario" onClick={() => vaiVoltar(s)}>Vai voltar</button>
              <button className="btn mini sec" onClick={() => setAcao({ sac: s, tipo: 'nao-volta' })}>Não volta</button>
              <button className="btn mini sec" onClick={() => setAcao({ sac: s, tipo: 'chegou' })}>Já chegou</button>
              <button className="btn mini fantasma" onClick={() => setAcao({ sac: s, tipo: 'cancelar' })}>Cancelar</button>
            </>))}
            {!semDef.length && <tr><td colSpan={8} className="vazio">Tudo definido</td></tr>}
          </tbody>
        </table>
      </div>

      {!sacs.length && <p className="ajuda">Nenhum SAC em aberto. <Link to="/sac/novo">Lançar SAC</Link></p>}

      {acao && (
        <AcoesSac sac={acao.sac} acao={acao.tipo} onFechar={() => setAcao(null)}
          onFeito={() => feito(acao.tipo === 'chegou' ? `Entrada feita. Estoque atualizado (SAC #${acao.sac.numero}).`
            : acao.tipo === 'nao-volta' ? `SAC #${acao.sac.numero} concluído sem retorno.` : `SAC #${acao.sac.numero} cancelado.`)} />
      )}
      {detalhe && <SacDetalheModal id={detalhe} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}
