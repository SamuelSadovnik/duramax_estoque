import { useState } from 'react';
import { api } from '../api';
import Erro from '../components/Erro';
import Cabecalho from '../components/Cabecalho';

export default function MinhaSenha() {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null); setOk(false);
    try { await api('/minha-senha', { body: { atual, nova } }); setOk(true); setAtual(''); setNova(''); }
    catch (err) { setErro((err as Error).message); }
  }
  return (
    <div className="pagina estreita">
      <Cabecalho sobre="Sua conta" titulo="Trocar senha" />
      <form className="form cartao" onSubmit={salvar}>
        <label>Senha atual<input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} required /></label>
        <label>Nova senha<input type="password" value={nova} onChange={(e) => setNova(e.target.value)} required minLength={4} /></label>
        <Erro msg={erro} />
        {ok && <div className="alerta ok">Senha alterada.</div>}
        <div className="botoes"><button>Salvar</button></div>
      </form>
    </div>
  );
}
