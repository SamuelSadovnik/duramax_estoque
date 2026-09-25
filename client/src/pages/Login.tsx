import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import type { Usuario } from '../types';

export default function Login({ onEntrar }: { onEntrar: (u: Usuario) => void }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setEntrando(true);
    try {
      const r = await api<{ usuario: Usuario }>('/login', { body: { login, senha } });
      setSenha('');
      onEntrar(r.usuario);
    } catch (err) { setErro((err as Error).message); } finally { setEntrando(false); }
  }

  return (
    <div className="login">
      <section className="login-lado" aria-hidden>
        <img src="/logo-branco.png" alt="" />
      </section>

      <section className="login-painel">
        <form className="login-form" onSubmit={entrar}>
          <h1>Entrar</h1>
          <p className="descricao">Estoque originado de SAC</p>

          <label className="campo">
            <span>Usuário</span>
            <input autoFocus autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
          </label>
          <label className="campo">
            <span>Senha</span>
            <div className="campo-senha">
              <input type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              <button type="button" className="icone-btn escuro" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {erro && <div className="aviso erro" role="alert">{erro}</div>}

          <button className="btn primario grande" disabled={entrando}>
            {entrando ? 'Entrando…' : <>Entrar <ArrowRight size={18} /></>}
          </button>
        </form>
      </section>
    </div>
  );
}
