import { useState } from 'react';
import { api, setToken } from '../api';
import type { Usuario } from '../types';
import Erro from '../components/Erro';

export default function Login({ onEntrar }: { onEntrar: (u: Usuario) => void }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const r = await api<{ token: string; usuario: Usuario }>('/login', { body: { login, senha } });
      setToken(r.token);
      onEntrar(r.usuario);
    } catch (err) { setErro((err as Error).message); }
  }

  return (
    <div className="login-fundo">
      <form className="login-card form" onSubmit={entrar}>
        <div className="marca grande"><img src="/logo.png" alt="Duramax Tintas & Vernizes" /><span>Estoque SAC</span></div>
        <label>Usuário<input autoFocus value={login} onChange={(e) => setLogin(e.target.value)} required /></label>
        <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></label>
        <Erro msg={erro} />
        <button>Entrar</button>
      </form>
    </div>
  );
}
