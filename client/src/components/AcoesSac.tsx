import { useState } from 'react';
import { api } from '../api';
import { hoje, num } from '../format';
import type { Sac } from '../types';
import Modal from './Modal';
import Erro from './Erro';

type Acao = 'chegou' | 'nao-volta' | 'cancelar';

/** Modais das ações de um SAC: chegou na fábrica, não volta e cancelar */
export default function AcoesSac({ sac, acao, onFechar, onFeito }: { sac: Sac; acao: Acao; onFechar: () => void; onFeito: () => void }) {
  const [nota, setNota] = useState('');
  const [qtd, setQtd] = useState(String(sac.quantidade));
  const [dataEnt, setDataEnt] = useState(hoje());
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setSalvando(true);
    try {
      if (acao === 'chegou') await api(`/sacs/${sac.id}/entrada`, { body: { nota, quantidade: qtd, data: dataEnt } });
      if (acao === 'nao-volta') await api(`/sacs/${sac.id}/sem-retorno`, { body: { resolucao: texto } });
      if (acao === 'cancelar') await api(`/sacs/${sac.id}/cancelar`, { body: { motivo: texto } });
      onFeito();
    } catch (err) {
      setErro((err as Error).message);
    } finally { setSalvando(false); }
  }

  const resumo = (
    <p className="resumo-sac">
      SAC <b>#{sac.numero}</b> · {sac.cliente} · <b>{num(sac.quantidade)}</b> × {sac.produto_descricao}
    </p>
  );

  if (acao === 'chegou') {
    const dif = Number(qtd.replace(',', '.')) - sac.quantidade;
    return (
      <Modal titulo="Material chegou na fábrica" onFechar={onFechar}>
        <form onSubmit={confirmar} className="form">
          {resumo}
          <label>Nº da nota de entrada
            <input autoFocus value={nota} onChange={(e) => setNota(e.target.value)} required />
          </label>
          <div className="linha-2">
            <label>Quantidade que chegou
              <input inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} required />
            </label>
            <label>Data de entrada
              <input type="date" value={dataEnt} onChange={(e) => setDataEnt(e.target.value)} required />
            </label>
          </div>
          {Number.isFinite(dif) && dif !== 0 && (
            <div className="alerta aviso">Diferença de {dif > 0 ? '+' : ''}{num(dif)} em relação ao SAC ({num(sac.quantidade)}).</div>
          )}
          <Erro msg={erro} />
          <div className="botoes">
            <button type="button" className="sec" onClick={onFechar}>Voltar</button>
            <button disabled={salvando}>Dar entrada no estoque</button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal titulo={acao === 'nao-volta' ? 'Não volta pra fábrica' : 'Cancelar SAC'} onFechar={onFechar}>
      <form onSubmit={confirmar} className="form">
        {resumo}
        <label>{acao === 'nao-volta' ? 'O que aconteceu com o produto?' : 'Por que cancelar?'}
          <textarea autoFocus rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} required
            placeholder={acao === 'nao-volta' ? 'Ex.: descartado no cliente, gerado crédito…' : 'Ex.: lançado em duplicidade'} />
        </label>
        <Erro msg={erro} />
        <div className="botoes">
          <button type="button" className="sec" onClick={onFechar}>Voltar</button>
          <button disabled={salvando} className={acao === 'cancelar' ? 'perigo' : ''}>
            {acao === 'nao-volta' ? 'Concluir SAC' : 'Cancelar SAC'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
