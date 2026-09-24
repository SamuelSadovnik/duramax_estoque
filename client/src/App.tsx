import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, getToken, onSessaoExpirada, setToken } from './api';
import type { Usuario } from './types';
import Login from './pages/Login';
import Estoque from './pages/Estoque';
import NovoSac from './pages/NovoSac';
import SacsAbertos from './pages/SacsAbertos';
import SacsResolvidos from './pages/SacsResolvidos';
import Logs from './pages/Logs';
import Cadastros from './pages/Cadastros';
import MinhaSenha from './pages/MinhaSenha';

interface Ctx { usuario: Usuario; sair: () => void }
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => useContext(AuthCtx)!;

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    onSessaoExpirada(() => { setToken(null); setUsuario(null); });
    if (!getToken()) { setCarregando(false); return; }
    api<Usuario>('/me').then(setUsuario).catch(() => setToken(null)).finally(() => setCarregando(false));
  }, []);

  const sair = () => {
    api('/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setUsuario(null);
  };

  if (carregando) return <div className="centro">Carregando…</div>;
  if (!usuario) return <Login onEntrar={(u) => setUsuario(u)} />;

  return (
    <AuthCtx.Provider value={{ usuario, sair }}>
      <div className="layout">
        <aside className="menu">
          <div className="marca">
            <img src="/logo-branco.png" alt="Duramax Tintas & Vernizes" />
            <span>Estoque SAC</span>
          </div>
          <nav>
            <NavLink to="/" end>Estoque</NavLink>
            <NavLink to="/sac/novo">Lançar SAC</NavLink>
            <NavLink to="/sac/abertos">SACs em aberto</NavLink>
            <NavLink to="/sac/resolvidos">SACs resolvidos</NavLink>
            <NavLink to="/logs">Histórico / Logs</NavLink>
            <NavLink to="/cadastros">Cadastros</NavLink>
          </nav>
          <div className="usuario-box">
            <div className="usuario-nome">{usuario.nome}</div>
            <div className="usuario-perfil">{usuario.perfil === 'admin' ? 'Administrador' : 'Operador'}</div>
            <div className="usuario-acoes">
              <NavLink to="/minha-senha">Trocar senha</NavLink>
              <button className="link" onClick={sair}>Sair</button>
            </div>
          </div>
        </aside>
        <main className="conteudo">
          <Routes>
            <Route path="/" element={<Estoque />} />
            <Route path="/sac/novo" element={<NovoSac />} />
            <Route path="/sac/abertos" element={<SacsAbertos />} />
            <Route path="/sac/resolvidos" element={<SacsResolvidos />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="/minha-senha" element={<MinhaSenha />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </AuthCtx.Provider>
  );
}
