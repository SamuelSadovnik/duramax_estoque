import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { hashSenha } from './auth';

/**
 * Banco de dados:
 *  - Com DATABASE_URL (Vercel / Neon / qualquer Postgres) → usa `pg`
 *  - Sem DATABASE_URL (computador local) → usa PGlite, um Postgres embutido salvo em ./data
 */
type Params = unknown[];
interface Executor { query(sql: string, params?: Params): Promise<{ rows: any[] }> }
interface Driver extends Executor { transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> }

async function criarDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (url) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url, max: 3 });
    return {
      query: (sql, params) => pool.query(sql, params as any[]),
      async transaction(fn) {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const r = await fn({ query: (s, p) => c.query(s, p as any[]) });
          await c.query('COMMIT');
          return r;
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        } finally { c.release(); }
      },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const pasta = process.env.DB_PATH ?? join(process.cwd(), 'data', 'pglite');
  mkdirSync(pasta, { recursive: true });
  const lite = new PGlite(pasta);
  return {
    query: (sql, params) => lite.query(sql, params),
    transaction: (fn) => lite.transaction((tx) => fn({ query: (s, p) => tx.query(s, p) })),
  };
}

let driver: Driver;
const txAtual = new AsyncLocalStorage<Executor>();

/** Executa SQL (dentro da transação atual, se houver) e devolve as linhas */
export async function sql<T = any>(texto: string, params: Params = []): Promise<T[]> {
  const ex = txAtual.getStore() ?? driver;
  return (await ex.query(texto, params)).rows as T[];
}
export async function sql1<T = any>(texto: string, params: Params = []): Promise<T | undefined> {
  return (await sql<T>(texto, params))[0];
}
/** Executa fn numa transação: tudo ou nada */
export function transacao<T>(fn: () => Promise<T>): Promise<T> {
  if (txAtual.getStore()) return fn();
  return driver.transaction((tx) => txAtual.run(tx, fn));
}

/** Data/hora no fuso de Brasília, formato AAAA-MM-DD HH:MM:SS */
export function agora(): string {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => f.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}:${g('second')}`;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin','operador')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_login ON usuarios (lower(login));
CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL,
  cod_barras TEXT,
  embalagem INTEGER,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS motivos (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_motivos_nome ON motivos (lower(nome));
CREATE TABLE IF NOT EXISTS sacs (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  cliente TEXT NOT NULL,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade DOUBLE PRECISION NOT NULL CHECK (quantidade > 0),
  nf_venda TEXT,
  observacao TEXT,
  status TEXT NOT NULL CHECK (status IN ('ABERTO','AGUARDANDO','RECEBIDO','SEM_RETORNO','CANCELADO')),
  volta_fabrica INTEGER,
  nf_entrada TEXT,
  data_entrada TEXT,
  qtd_recebida DOUBLE PRECISION,
  resolucao TEXT,
  data_abertura TEXT NOT NULL,
  data_modificacao TEXT NOT NULL,
  data_conclusao TEXT,
  criado_por INTEGER NOT NULL REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS sac_motivos (
  sac_id INTEGER NOT NULL REFERENCES sacs(id) ON DELETE CASCADE,
  motivo_id INTEGER NOT NULL REFERENCES motivos(id),
  PRIMARY KEY (sac_id, motivo_id)
);
CREATE TABLE IF NOT EXISTS movimentacoes (
  id SERIAL PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA_SAC','AJUSTE','ESTORNO')),
  quantidade DOUBLE PRECISION NOT NULL,
  nota TEXT,
  sac_id INTEGER REFERENCES sacs(id),
  motivo TEXT,
  estorno_de INTEGER REFERENCES movimentacoes(id),
  estornada INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mov_nota_produto
  ON movimentacoes (nota, produto_id) WHERE tipo = 'ENTRADA_SAC' AND estornada = 0;
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  data TEXT NOT NULL,
  usuario_id INTEGER,
  usuario_nome TEXT,
  entidade TEXT NOT NULL,
  entidade_id INTEGER,
  acao TEXT NOT NULL,
  detalhes TEXT
);
CREATE INDEX IF NOT EXISTS ix_logs_entidade ON logs (entidade, entidade_id);
`;

async function iniciar() {
  driver = await criarDriver();
  for (const cmd of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await sql(cmd);

  const conta = async (t: string) => (await sql1<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${t}`))!.n;
  if (!(await conta('usuarios'))) {
    await sql('INSERT INTO usuarios (nome, login, senha_hash, perfil, criado_em) VALUES ($1,$2,$3,$4,$5)',
      ['Administrador', 'admin', hashSenha('admin123'), 'admin', agora()]);
  }
  if (!(await conta('motivos'))) {
    for (const m of ['Gelatinamento', 'Problema no produto', 'Avaria de transporte'])
      await sql('INSERT INTO motivos (nome) VALUES ($1)', [m]);
  }
  if (!(await conta('produtos'))) {
    await sql(`INSERT INTO produtos (codigo, descricao, unidade, cod_barras, embalagem, criado_em, atualizado_em)
      VALUES ($1,$2,$3,$4,$5,$6,$6)`, ['00170', 'DURAFORT METAIS DF BRANCO PURO BR 3,6 L', 'GALÃO 3,6 L', '1000000001709', 4, agora()]);
  }
}

let pronto: Promise<void> | null = null;
/** Garante que o banco está conectado e com as tabelas criadas (1x por processo) */
export function bancoPronto(): Promise<void> {
  pronto ??= iniciar().catch((e) => { pronto = null; throw e; });
  return pronto;
}

export interface UsuarioSessao { id: number; nome: string; login: string; perfil: 'admin' | 'operador' }

export async function registrarLog(u: UsuarioSessao | null, entidade: string, entidadeId: number | null, acao: string, detalhes?: string) {
  await sql('INSERT INTO logs (data, usuario_id, usuario_nome, entidade, entidade_id, acao, detalhes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [agora(), u?.id ?? null, u?.nome ?? null, entidade, entidadeId, acao, detalhes ?? null]);
}
