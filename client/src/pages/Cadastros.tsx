import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { dataHora } from '../format';
import type { Motivo, Produto, Usuario } from '../types';
import Modal from '../components/Modal';
import Erro from '../components/Erro';

type Aba = 'produtos' | 'motivos' | 'usuarios';

export default function Cadastros() {
  const { usuario } = useAuth();
  const admin = usuario.perfil === 'admin';
  const [aba, setAba] = useState<Aba>('produtos');
  return (
    <div className="pagina">
      <h1>Cadastros</h1>
      <div className="abas">
        <button className={aba === 'produtos' ? 'on' : ''} onClick={() => setAba('produtos')}>Produtos</button>
        <button className={aba === 'motivos' ? 'on' : ''} onClick={() => setAba('motivos')}>Motivos</button>
        {admin && <button className={aba === 'usuarios' ? 'on' : ''} onClick={() => setAba('usuarios')}>Usuários</button>}
      </div>
      {!admin && <p className="ajuda">Somente administradores podem alterar cadastros.</p>}
      {aba === 'produtos' && <Produtos admin={admin} />}
      {aba === 'motivos' && <Motivos admin={admin} />}
      {aba === 'usuarios' && admin && <Usuarios />}
    </div>
  );
}

// ---------- Produtos ----------
function Produtos({ admin }: { admin: boolean }) {
  const [lista, setLista] = useState<Produto[]>([]);
  const [edit, setEdit] = useState<Partial<Produto> | null>(null);
  const carregar = useCallback(() => { api<Produto[]>('/produtos').then(setLista); }, []);
  useEffect(carregar, [carregar]);
  return (
    <div className="cartao">
      {admin && <div className="barra-filtros"><button onClick={() => setEdit({ ativo: 1 })}>+ Novo produto</button></div>}
      <table>
        <thead><tr><th>Código</th><th>Descrição</th><th>Unidade</th><th>Cód. barras</th><th className="n">Embalagem</th><th>Situação</th><th>Alterado em</th><th></th></tr></thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id} className={p.ativo ? '' : 'inativo'}>
              <td>{p.codigo}</td><td>{p.descricao}</td><td>{p.unidade}</td><td>{p.cod_barras ?? '—'}</td>
              <td className="n">{p.embalagem ?? '—'}</td><td>{p.ativo ? 'Ativo' : 'Inativo'}</td><td>{dataHora(p.atualizado_em)}</td>
              <td className="acoes">{admin && <button className="mini sec" onClick={() => setEdit(p)}>Editar</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && <ProdutoModal p={edit} onFechar={() => setEdit(null)} onFeito={() => { setEdit(null); carregar(); }} />}
    </div>
  );
}

function ProdutoModal({ p, onFechar, onFeito }: { p: Partial<Produto>; onFechar: () => void; onFeito: () => void }) {
  const [v, setV] = useState({
    codigo: p.codigo ?? '', descricao: p.descricao ?? '', unidade: p.unidade ?? '',
    cod_barras: p.cod_barras ?? '', embalagem: p.embalagem ? String(p.embalagem) : '', ativo: p.ativo !== 0,
  });
  const [erro, setErro] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(p.id ? `/produtos/${p.id}` : '/produtos', { method: p.id ? 'PUT' : 'POST', body: v });
      onFeito();
    } catch (err) { setErro((err as Error).message); }
  }
  return (
    <Modal titulo={p.id ? 'Editar produto' : 'Novo produto'} onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <div className="linha-2">
          <label>Código<input autoFocus value={v.codigo} onChange={set('codigo')} required /></label>
          <label>Unidade<input value={v.unidade} onChange={set('unidade')} placeholder="GALÃO 3,6 L" required /></label>
        </div>
        <label>Descrição<input value={v.descricao} onChange={set('descricao')} required /></label>
        <div className="linha-2">
          <label>Cód. barras<input value={v.cod_barras} onChange={set('cod_barras')} /></label>
          <label>Embalagem (un. por caixa)<input inputMode="numeric" value={v.embalagem} onChange={set('embalagem')} /></label>
        </div>
        {p.id && <label className="check"><input type="checkbox" checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} /> Produto ativo</label>}
        <Erro msg={erro} />
        <div className="botoes"><button type="button" className="sec" onClick={onFechar}>Voltar</button><button>Salvar</button></div>
      </form>
    </Modal>
  );
}

// ---------- Motivos ----------
function Motivos({ admin }: { admin: boolean }) {
  const [lista, setLista] = useState<Motivo[]>([]);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => { api<Motivo[]>('/motivos').then(setLista); }, []);
  useEffect(carregar, [carregar]);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    try { await api('/motivos', { body: { nome: novo } }); setNovo(''); carregar(); } catch (err) { setErro((err as Error).message); }
  }
  async function alternar(m: Motivo) {
    await api(`/motivos/${m.id}`, { method: 'PUT', body: { nome: m.nome, ativo: !m.ativo } }); carregar();
  }
  return (
    <div className="cartao">
      {admin && (
        <form className="barra-filtros" onSubmit={add}>
          <input placeholder="Novo motivo" value={novo} onChange={(e) => setNovo(e.target.value)} required />
          <button>Adicionar</button>
        </form>
      )}
      <Erro msg={erro} />
      <table>
        <thead><tr><th>Motivo</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {lista.map((m) => (
            <tr key={m.id} className={m.ativo ? '' : 'inativo'}>
              <td>{m.nome}</td><td>{m.ativo ? 'Ativo' : 'Inativo'}</td>
              <td className="acoes">{admin && <button className="mini sec" onClick={() => alternar(m)}>{m.ativo ? 'Desativar' : 'Reativar'}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Usuários ----------
function Usuarios() {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [edit, setEdit] = useState<Partial<Usuario> | null>(null);
  const carregar = useCallback(() => { api<Usuario[]>('/usuarios').then(setLista); }, []);
  useEffect(carregar, [carregar]);
  return (
    <div className="cartao">
      <div className="barra-filtros"><button onClick={() => setEdit({ perfil: 'operador', ativo: 1 })}>+ Novo usuário</button></div>
      <table>
        <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Situação</th><th>Criado em</th><th></th></tr></thead>
        <tbody>
          {lista.map((u) => (
            <tr key={u.id} className={u.ativo ? '' : 'inativo'}>
              <td>{u.nome}</td><td>{u.login}</td><td>{u.perfil === 'admin' ? 'Administrador' : 'Operador'}</td>
              <td>{u.ativo ? 'Ativo' : 'Inativo'}</td><td>{dataHora(u.criado_em)}</td>
              <td className="acoes"><button className="mini sec" onClick={() => setEdit(u)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && <UsuarioModal u={edit} onFechar={() => setEdit(null)} onFeito={() => { setEdit(null); carregar(); }} />}
    </div>
  );
}

function UsuarioModal({ u, onFechar, onFeito }: { u: Partial<Usuario>; onFechar: () => void; onFeito: () => void }) {
  const [v, setV] = useState({ nome: u.nome ?? '', login: u.login ?? '', senha: '', perfil: u.perfil ?? 'operador', ativo: u.ativo !== 0 });
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(u.id ? `/usuarios/${u.id}` : '/usuarios', { method: u.id ? 'PUT' : 'POST', body: v });
      onFeito();
    } catch (err) { setErro((err as Error).message); }
  }
  return (
    <Modal titulo={u.id ? 'Editar usuário' : 'Novo usuário'} onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <label>Nome<input autoFocus value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required /></label>
        <label>Login<input value={v.login} disabled={!!u.id} onChange={(e) => setV({ ...v, login: e.target.value })} required /></label>
        <label>{u.id ? 'Nova senha (deixe vazio para manter)' : 'Senha'}
          <input type="password" value={v.senha} onChange={(e) => setV({ ...v, senha: e.target.value })} required={!u.id} minLength={4} />
        </label>
        <label>Perfil
          <select value={v.perfil} onChange={(e) => setV({ ...v, perfil: e.target.value as Usuario['perfil'] })}>
            <option value="operador">Operador (lança e resolve SAC)</option>
            <option value="admin">Administrador (também edita cadastros e usuários)</option>
          </select>
        </label>
        {u.id && <label className="check"><input type="checkbox" checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} /> Usuário ativo</label>}
        <Erro msg={erro} />
        <div className="botoes"><button type="button" className="sec" onClick={onFechar}>Voltar</button><button>Salvar</button></div>
      </form>
    </Modal>
  );
}
