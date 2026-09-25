import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Boxes, CheckCheck, History, KeyRound, LogOut, Settings2, Truck } from 'lucide-react';
import { api, onSessaoExpirada } from './api';
import { limparCache, preCarregar } from './dados';
import type { Usuario } from './types';
import Login from './pages/Login';
import Estoque from './pages/Estoque';
import LancarSacModal from './components/LancarSacModal';
import SacsAbertos from './pages/SacsAbertos';
import SacsResolvidos from './pages/SacsResolvidos';
import Logs from './pages/Logs';
import Cadastros from './pages/Cadastros';
import MinhaSenha from './pages/MinhaSenha';

interface Ctx { usuario: Usuario; sair: () => void; lancarSac: () => void }
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => useContext(AuthCtx)!;

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [lancando, setLancando] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    onSessaoExpirada(() => setUsuario(null));
    api<Usuario>('/me').then(setUsuario).catch(() => setUsuario(null)).finally(() => setCarregando(false));
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  // Assim que entra, já busca os dados das telas principais
  useEffect(() => { if (usuario) preCarregar('/estoque/painel', '/sacs?grupo=abertos', '/produtos', '/motivos', '/clientes'); }, [usuario]);

  const sair = () => {
    api('/logout', { method: 'POST' }).catch(() => {}).finally(() => { limparCache(); setUsuario(null); });
  };

  if (carregando) return <div className="carregando"><span className="pulso" /></div>;
  if (!usuario) return <Login onEntrar={(u) => setUsuario(u)} />;

  return (
    <AuthCtx.Provider value={{ usuario, sair, lancarSac: () => setLancando(true) }}>
      <div className="app">
        <aside className="lateral">
          <div className="lateral-marca">
            <img src="/logo-branco.png" alt="Duramax Tintas & Vernizes" />
            
          </div>

          <nav className="lateral-nav" aria-label="Menu principal">
            <div className="nav-grupo">Operação</div>
            <NavLink to="/" end><Boxes size={18} /> Estoque</NavLink>
            <NavLink to="/sac/abertos"><Truck size={18} /> SACs em aberto</NavLink>
            <NavLink to="/sac/resolvidos"><CheckCheck size={18} /> SACs resolvidos</NavLink>
            <div className="nav-grupo">Controle</div>
            <NavLink to="/logs"><History size={18} /> Histórico</NavLink>
            <NavLink to="/cadastros"><Settings2 size={18} /> Cadastros</NavLink>
          </nav>

          <div className="lateral-usuario">
            <div className="avatar" aria-hidden>{iniciais(usuario.nome)}</div>
            <div className="usuario-info">
              <strong>{usuario.nome}</strong>
              <span>{usuario.perfil === 'admin' ? 'Administrador' : 'Operador'}</span>
            </div>
            <NavLink to="/minha-senha" className="icone-btn" title="Trocar senha" aria-label="Trocar senha"><KeyRound size={16} /></NavLink>
            <button className="icone-btn" onClick={sair} title="Sair" aria-label="Sair"><LogOut size={16} /></button>
          </div>
        </aside>

        <main className="principal">
          <Routes>
            <Route path="/" element={<Estoque />} />
            <Route path="/sac/abertos" element={<SacsAbertos />} />
            <Route path="/sac/resolvidos" element={<SacsResolvidos />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="/minha-senha" element={<MinhaSenha />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
      {lancando && <LancarSacModal onFechar={() => setLancando(false)} />}
    </AuthCtx.Provider>
  );
}
