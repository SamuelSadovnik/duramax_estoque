import { useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import type { Usuario } from '../types';
import Erro from '../components/Erro';
import Cabecalho from '../components/Cabecalho';
import { useAuth } from '../App';

/** Mesmas regras do servidor, para mostrar enquanto a pessoa digita */
function regras(senha: string, u: Pick<Usuario, 'login' | 'nome'>) {
  const s = senha.toLowerCase();
  const nome = u.nome.split(/\s+/)[0]?.toLowerCase() ?? '';
  return [
    { ok: senha.length >= 8, txt: 'Pelo menos 8 caracteres' },
    { ok: /[a-zA-Z]/.test(senha) && /[0-9]/.test(senha), txt: 'Letras e números' },
    { ok: !!senha && !s.includes(u.login.toLowerCase()) && !(nome.length >= 3 && s.includes(nome)), txt: 'Sem o seu login ou nome' },
  ];
}

function FormSenha({ usuario, onFeito, botao }: { usuario: Usuario; onFeito: () => void; botao: string }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const lista = regras(nova, usuario);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    if (nova !== conf) return setErro('A confirmação não é igual à nova senha.');
    setSalvando(true);
    try { await api('/minha-senha', { body: { atual, nova } }); setAtual(''); setNova(''); setConf(''); onFeito(); }
    catch (err) { setErro((err as Error).message); } finally { setSalvando(false); }
  }
  const tipo = ver ? 'text' : 'password';
  return (
    <form className="form" onSubmit={salvar}>
      <label>Senha atual<input type={tipo} autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required /></label>
      <label>Nova senha
        <div className="campo-senha">
          <input type={tipo} autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} required maxLength={128} />
          <button type="button" className="icone-btn escuro" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senhas' : 'Mostrar senhas'}>
            {ver ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      <ul className="regras">
        {lista.map((r) => <li key={r.txt} className={r.ok ? 'ok' : ''}><Check size={14} /> {r.txt}</li>)}
      </ul>
      <label>Confirmar nova senha<input type={tipo} autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} required /></label>
      <Erro msg={erro} />
      <div className="botoes"><button className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : botao}</button></div>
    </form>
  );
}

export default function MinhaSenha() {
  const [ok, setOk] = useState(false);
  const { usuario: u } = useAuth();
  return (
    <div className="pagina estreita">
      <Cabecalho titulo="Trocar senha" descricao="Ao trocar, os outros computadores conectados com o seu usuário são desconectados." />
      <div className="cartao folga">
        {ok && <div className="alerta ok">Senha alterada.</div>}
        <FormSenha usuario={u} botao="Salvar nova senha" onFeito={() => setOk(true)} />
      </div>
    </div>
  );
}
