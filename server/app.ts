import express, { type NextFunction, type Request, type Response } from 'express';
import { agora, bancoPronto, ErroBanco, hostBanco, registrarLog, sql, sql1, transacao, variavelBanco, type UsuarioSessao } from './db';
import { conferirSenha, HASH_FALSO, hashSenha, hashToken, novoToken, precisaRehash, validarSenha } from './auth';

type Req = Request & { usuario?: UsuarioSessao };

class ErroApp extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}
const falha = (status: number, msg: string): never => { throw new ErroApp(status, msg); };

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

// Cabeçalhos de segurança em todas as respostas da API
app.use('/api', (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '50kb' }));

// Proteção contra CSRF: toda requisição que altera dados precisa do cabeçalho enviado pelo próprio sistema
app.use('/api', (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'duramax')
    return next(new ErroApp(403, 'Requisição bloqueada.'));
  next();
});
// Diagnóstico: abra /api/saude no navegador para ver se o banco está conectado
app.get('/api/saude', async (_req, res) => {
  try {
    const t0 = Date.now();
    await bancoPronto();
    const t1 = Date.now();
    const r = await sql1<{ usuarios: number }>('SELECT COUNT(*)::int AS usuarios FROM usuarios');
    res.json({
      ok: true, banco: variavelBanco, servidor_banco: hostBanco(), regiao_vercel: process.env.VERCEL_REGION ?? null,
      usuarios: r?.usuarios, tempo_inicio_ms: t1 - t0, tempo_consulta_ms: Date.now() - t1, hora: agora(),
    });
  } catch (e) {
    res.status(503).json({ ok: false, banco: variavelBanco, erro: (e as Error).message });
  }
});
app.use('/api', async (_req, _res, next) => { try { await bancoPronto(); next(); } catch (e) { next(e); } });

// ---------------- Helpers ----------------
function texto(v: unknown, campo: string, obrigatorio = true): string | null {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (!s && obrigatorio) falha(400, `Campo obrigatório: ${campo}`);
  return s || null;
}
function numero(v: unknown, campo: string): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) falha(400, `${campo} deve ser um número maior que zero`);
  return n;
}
const usuario = (req: Req): UsuarioSessao => req.usuario ?? falha(401, 'Não autenticado');
const ativoDe = (v: unknown) => (v === false || v === 0 ? 0 : 1);
const LABEL_STATUS: Record<string, string> = {
  ABERTO: 'Sem definição', AGUARDANDO: 'A caminho da fábrica', RECEBIDO: 'Recebido na fábrica',
  SEM_RETORNO: 'Resolvido sem retorno', CANCELADO: 'Cancelado',
};

// ---------------- Autenticação ----------------
const COOKIE = 'sac_sessao';
const SESSAO_MAX_MS = 7 * 24 * 3600 * 1000;   // sessão dura no máximo 7 dias
const SESSAO_OCIOSA_MS = 12 * 3600 * 1000;     // e expira após 12 h sem uso
const MAX_FALHAS = 5;                          // 5 senhas erradas seguidas…
const BLOQUEIO_MS = 15 * 60 * 1000;            // …bloqueiam o usuário por 15 min
const MAX_TENTATIVAS_IP = 30;                  // e no máximo 30 tentativas por IP a cada 15 min

function lerCookie(req: Request, nome: string): string | null {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}
function gravarCookie(req: Request, res: Response, valor: string, maxAgeMs: number) {
  const seguro = req.secure || req.get('x-forwarded-proto') === 'https';
  res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${seguro ? '; Secure' : ''}`);
}
const ipDe = (req: Request) => (req.ip ?? 'desconhecido').slice(0, 64);
const semSenha = (u: any): UsuarioSessao => ({ id: u.id, nome: u.nome, login: u.login, perfil: u.perfil, trocar_senha: u.trocar_senha });

app.post('/api/login', async (req, res) => {
  const login = String(req.body?.login ?? '').trim().slice(0, 100);
  const senha = String(req.body?.senha ?? '').slice(0, 200);
  const ip = ipDe(req);
  const agoraMs = Date.now();
  if (!login || !senha) falha(400, 'Informe usuário e senha.');

  // Limite por IP (contra robôs testando senhas)
  await sql('DELETE FROM tentativas_login WHERE momento < $1', [agoraMs - BLOQUEIO_MS]);
  const porIp = (await sql1<{ n: number }>('SELECT COUNT(*)::int AS n FROM tentativas_login WHERE ip = $1', [ip]))!.n;
  if (porIp >= MAX_TENTATIVAS_IP) falha(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');

  const u = await sql1('SELECT * FROM usuarios WHERE lower(login) = lower($1)', [login]);
  if (u?.bloqueado_ate && u.bloqueado_ate > agoraMs) {
    const min = Math.ceil((u.bloqueado_ate - agoraMs) / 60000);
    falha(429, `Usuário bloqueado por excesso de tentativas. Tente de novo em ${min} min ou peça a um administrador para redefinir a senha.`);
  }
  // Sempre calcula um hash, mesmo sem usuário, para não revelar pelo tempo quais logins existem
  const ok = conferirSenha(senha, u?.senha_hash ?? HASH_FALSO) && !!u && u.ativo === 1;
  if (!ok) {
    await sql('INSERT INTO tentativas_login (ip, momento) VALUES ($1,$2)', [ip, agoraMs]);
    if (u) {
      const falhas = (u.falhas ?? 0) + 1;
      const bloquear = falhas >= MAX_FALHAS;
      await sql('UPDATE usuarios SET falhas = $1, bloqueado_ate = $2 WHERE id = $3',
        [bloquear ? 0 : falhas, bloquear ? agoraMs + BLOQUEIO_MS : null, u.id]);
      await registrarLog(null, 'usuario', u.id, bloquear ? 'Usuário bloqueado' : 'Login falhou',
        `${u.login} · IP ${ip}${bloquear ? ` · ${MAX_FALHAS} senhas erradas, bloqueado por 15 min` : ''}`);
    }
    falha(401, 'Usuário ou senha incorretos.');
  }

  // Senha certa: zera as falhas e atualiza o hash se estiver no formato antigo
  await sql('UPDATE usuarios SET falhas = 0, bloqueado_ate = NULL WHERE id = $1', [u.id]);
  if (precisaRehash(u.senha_hash)) await sql('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hashSenha(senha), u.id]);
  await sql('DELETE FROM sessoes WHERE expira_em < $1 OR ultimo_uso < $2', [agoraMs, agoraMs - SESSAO_OCIOSA_MS]);

  const token = novoToken();
  await sql('INSERT INTO sessoes (token, usuario_id, criado_em, expira_em, ultimo_uso, ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [hashToken(token), u.id, agora(), agoraMs + SESSAO_MAX_MS, agoraMs, ip]);
  gravarCookie(req, res, token, SESSAO_MAX_MS);
  const sessao = semSenha(u);
  await registrarLog(sessao, 'usuario', u.id, 'Login', `IP ${ip}`);
  res.json({ usuario: sessao });
});

app.use('/api', async (req: Req, _res, next) => {
  try {
    const token = lerCookie(req, COOKIE);
    if (!token) return next(new ErroApp(401, 'Faça login para continuar.'));
    const agoraMs = Date.now();
    const th = hashToken(token);
    const u = await sql1(`SELECT u.id, u.nome, u.login, u.perfil, u.trocar_senha, s.ultimo_uso FROM sessoes s
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token = $1 AND u.ativo = 1 AND s.expira_em > $2 AND s.ultimo_uso > $3`, [th, agoraMs, agoraMs - SESSAO_OCIOSA_MS]);
    if (!u) return next(new ErroApp(401, 'Sua sessão expirou. Faça login de novo.'));
    if (agoraMs - u.ultimo_uso > 5 * 60 * 1000) await sql('UPDATE sessoes SET ultimo_uso = $1 WHERE token = $2', [agoraMs, th]);
    req.usuario = { ...semSenha(u), sessao: th };
    next();
  } catch (e) { next(e); }
});
const soAdmin = (req: Req, _res: Response, next: NextFunction) =>
  req.usuario?.perfil === 'admin' ? next() : next(new ErroApp(403, 'Apenas administradores'));

app.get('/api/me', (req: Req, res) => { const { sessao, ...u } = usuario(req); res.json(u); });
app.post('/api/logout', async (req: Req, res) => {
  await sql('DELETE FROM sessoes WHERE token = $1', [usuario(req).sessao]);
  gravarCookie(req, res, '', 0);
  res.json({ ok: true });
});
app.post('/api/minha-senha', async (req: Req, res) => {
  const u = usuario(req);
  const atual = String(req.body?.atual ?? '');
  const nova = String(req.body?.nova ?? '');
  const row = await sql1('SELECT senha_hash FROM usuarios WHERE id = $1', [u.id]);
  if (!conferirSenha(atual, row.senha_hash)) falha(400, 'A senha atual está incorreta.');
  const erro = validarSenha(nova, u.login, u.nome);
  if (erro) falha(400, erro);
  if (conferirSenha(nova, row.senha_hash)) falha(400, 'A nova senha precisa ser diferente da atual.');
  await transacao(async () => {
    await sql('UPDATE usuarios SET senha_hash = $1, trocar_senha = 0, senha_alterada_em = $2 WHERE id = $3', [hashSenha(nova), agora(), u.id]);
    // Encerra as outras sessões abertas desse usuário (outros computadores)
    await sql('DELETE FROM sessoes WHERE usuario_id = $1 AND token <> $2', [u.id, u.sessao]);
    await registrarLog(u, 'usuario', u.id, 'Alterou a própria senha', 'Outras sessões encerradas');
  });
  res.json({ ok: true });
});

// ---------------- Usuários ----------------
app.get('/api/usuarios', soAdmin, async (_req, res) => {
  res.json(await sql(`SELECT id, nome, login, perfil, ativo, criado_em, trocar_senha, senha_alterada_em,
    (bloqueado_ate IS NOT NULL AND bloqueado_ate > $1) AS bloqueado FROM usuarios ORDER BY nome`, [Date.now()]));
});
app.post('/api/usuarios', soAdmin, async (req: Req, res) => {
  const u = usuario(req);
  const nome = texto(req.body?.nome, 'nome')!;
  const login = texto(req.body?.login, 'login')!;
  const senha = String(req.body?.senha ?? '');
  const perfil = req.body?.perfil === 'admin' ? 'admin' : 'operador';
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(login)) falha(400, 'O login deve ter de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.');
  const erro = validarSenha(senha, login, nome);
  if (erro) falha(400, erro);
  if (await sql1('SELECT 1 FROM usuarios WHERE lower(login) = lower($1)', [login])) falha(400, 'Esse login já existe');
  const r = (await sql1('INSERT INTO usuarios (nome, login, senha_hash, perfil, criado_em) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [nome, login, hashSenha(senha), perfil, agora()]))!;
  await registrarLog(u, 'usuario', r.id, 'Cadastrou usuário', `${nome} (${login}), perfil ${perfil}`);
  res.json({ id: r.id });
});
app.put('/api/usuarios/:id', soAdmin, async (req: Req, res) => {
  const u = usuario(req);
  const id = Number(req.params.id);
  const at = await sql1('SELECT * FROM usuarios WHERE id = $1', [id]) ?? falha(404, 'Usuário não encontrado');
  const nome = texto(req.body?.nome, 'nome')!;
  const perfil = req.body?.perfil === 'admin' ? 'admin' : 'operador';
  const ativo = ativoDe(req.body?.ativo);
  if (id === u.id && (ativo === 0 || perfil !== 'admin')) falha(400, 'Você não pode desativar nem rebaixar seu próprio usuário');
  const mud: string[] = [];
  if (at.nome !== nome) mud.push(`nome: ${at.nome} → ${nome}`);
  if (at.perfil !== perfil) mud.push(`perfil: ${at.perfil} → ${perfil}`);
  if (at.ativo !== ativo) mud.push(ativo ? 'reativado' : 'desativado');
  await transacao(async () => {
    await sql('UPDATE usuarios SET nome = $1, perfil = $2, ativo = $3 WHERE id = $4', [nome, perfil, ativo, id]);
    if (req.body?.senha) {
      const erro = validarSenha(String(req.body.senha), at.login, nome);
      if (erro) falha(400, erro);
      // Nova senha desbloqueia o usuário e derruba as sessões dele
      await sql('UPDATE usuarios SET senha_hash = $1, falhas = 0, bloqueado_ate = NULL WHERE id = $2', [hashSenha(String(req.body.senha)), id]);
      await sql('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
      mud.push('senha redefinida');
    }
    if (!ativo || perfil !== at.perfil) await sql('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
    if (mud.length) await registrarLog(u, 'usuario', id, 'Alterou usuário', `${at.login}: ${mud.join('; ')}`);
  });
  res.json({ ok: true });
});

// ---------------- Produtos ----------------
const SQL_SALDO = `COALESCE((SELECT SUM(m.quantidade) FROM movimentacoes m WHERE m.produto_id = p.id), 0)`;
app.get('/api/produtos', async (_req, res) => {
  res.json(await sql(`SELECT p.*, ${SQL_SALDO} AS saldo,
      COALESCE((SELECT SUM(s.quantidade) FROM sacs s WHERE s.produto_id = p.id AND s.status = 'AGUARDANDO'), 0) AS a_caminho,
      COALESCE((SELECT SUM(s.quantidade) FROM sacs s WHERE s.produto_id = p.id AND s.status = 'ABERTO'), 0) AS sem_definicao
    FROM produtos p ORDER BY p.descricao`));
});
function dadosProduto(b: any) {
  return {
    codigo: texto(b?.codigo, 'código')!,
    descricao: texto(b?.descricao, 'descrição')!.toUpperCase(),
    unidade: texto(b?.unidade, 'unidade')!.toUpperCase(),
    cod_barras: texto(b?.cod_barras, 'código de barras', false),
    embalagem: b?.embalagem ? Number(b.embalagem) : null,
    ativo: ativoDe(b?.ativo),
  };
}
app.post('/api/produtos', soAdmin, async (req: Req, res) => {
  const u = usuario(req);
  const n = dadosProduto(req.body);
  if (await sql1('SELECT 1 FROM produtos WHERE codigo = $1', [n.codigo])) falha(400, 'Já existe produto com esse código');
  const r = (await sql1(`INSERT INTO produtos (codigo, descricao, unidade, cod_barras, embalagem, ativo, criado_em, atualizado_em)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id`, [n.codigo, n.descricao, n.unidade, n.cod_barras, n.embalagem, n.ativo, agora()]))!;
  await registrarLog(u, 'produto', r.id, 'Cadastrou produto', `${n.codigo} - ${n.descricao}`);
  res.json({ id: r.id });
});
app.put('/api/produtos/:id', soAdmin, async (req: Req, res) => {
  const u = usuario(req);
  const id = Number(req.params.id);
  const at = await sql1('SELECT * FROM produtos WHERE id = $1', [id]) ?? falha(404, 'Produto não encontrado');
  const n = dadosProduto(req.body);
  if (n.codigo !== at.codigo && await sql1('SELECT 1 FROM produtos WHERE codigo = $1', [n.codigo])) falha(400, 'Já existe produto com esse código');
  const mud = (Object.keys(n) as (keyof typeof n)[]).filter((k) => (at[k] ?? null) !== n[k]).map((k) => `${k}: ${at[k] ?? '—'} → ${n[k] ?? '—'}`);
  await sql(`UPDATE produtos SET codigo=$1, descricao=$2, unidade=$3, cod_barras=$4, embalagem=$5, ativo=$6, atualizado_em=$7 WHERE id=$8`,
    [n.codigo, n.descricao, n.unidade, n.cod_barras, n.embalagem, n.ativo, agora(), id]);
  if (mud.length) await registrarLog(u, 'produto', id, 'Alterou produto', mud.join('; '));
  res.json({ ok: true });
});

// ---------------- Motivos ----------------
app.get('/api/motivos', async (_req, res) => { res.json(await sql('SELECT * FROM motivos ORDER BY nome')); });
app.post('/api/motivos', soAdmin, async (req: Req, res) => {
  const u = usuario(req);
  const nome = texto(req.body?.nome, 'nome')!;
  if (await sql1('SELECT 1 FROM motivos WHERE lower(nome) = lower($1)', [nome])) falha(400, 'Esse motivo já existe');
  const r = (await sql1('INSERT INTO motivos (nome) VALUES ($1) RETURNING id', [nome]))!;
  await registrarLog(u, 'motivo', r.id, 'Cadastrou motivo', nome);
  res.json({ id: r.id });
});
app.put('/api/motivos/:id', soAdmin, async (req: Req, res) => {
  const u = usuario(req);
  const id = Number(req.params.id);
  const at = await sql1('SELECT * FROM motivos WHERE id = $1', [id]) ?? falha(404, 'Motivo não encontrado');
  const nome = texto(req.body?.nome, 'nome')!;
  const ativo = ativoDe(req.body?.ativo);
  await sql('UPDATE motivos SET nome = $1, ativo = $2 WHERE id = $3', [nome, ativo, id]);
  await registrarLog(u, 'motivo', id, 'Alterou motivo', `${at.nome} → ${nome}${ativo ? '' : ' (desativado)'}`);
  res.json({ ok: true });
});

app.get('/api/clientes', async (_req, res) => {
  res.json((await sql('SELECT DISTINCT cliente FROM sacs ORDER BY cliente')).map((r) => r.cliente));
});

// ---------------- SACs ----------------
const SQL_SAC = `
  SELECT s.*, p.codigo AS produto_codigo, p.descricao AS produto_descricao, p.unidade AS produto_unidade,
         u.nome AS criado_por_nome,
         (SELECT string_agg(mo.nome, ', ' ORDER BY mo.nome) FROM sac_motivos sm JOIN motivos mo ON mo.id = sm.motivo_id WHERE sm.sac_id = s.id) AS motivos,
         (SELECT string_agg(sm.motivo_id::text, ',') FROM sac_motivos sm WHERE sm.sac_id = s.id) AS motivo_ids,
         (COALESCE(s.data_conclusao, $$NOW$$)::date - s.data_abertura::date) AS dias
  FROM sacs s JOIN produtos p ON p.id = s.produto_id JOIN usuarios u ON u.id = s.criado_por`;
/** Monta a consulta de SAC trocando o marcador de "agora" pela data de Brasília */
const sqlSac = () => SQL_SAC.replace('$$NOW$$', `'${agora()}'`);

async function buscarSac(id: number): Promise<any> {
  return (await sql1(`${sqlSac()} WHERE s.id = $1`, [id])) ?? falha(404, 'SAC não encontrado');
}
async function salvarMotivos(sacId: number, ids: unknown) {
  const lista = Array.isArray(ids) ? [...new Set(ids.map(Number).filter(Number.isFinite))] : [];
  if (!lista.length) falha(400, 'Selecione ao menos um motivo');
  await sql('DELETE FROM sac_motivos WHERE sac_id = $1', [sacId]);
  for (const m of lista) {
    if (!(await sql1('SELECT 1 FROM motivos WHERE id = $1', [m]))) falha(400, 'Motivo inválido');
    await sql('INSERT INTO sac_motivos (sac_id, motivo_id) VALUES ($1,$2)', [sacId, m]);
  }
}

app.get('/api/sacs', async (req, res) => {
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (cond: string, v: unknown) => { args.push(v); where.push(cond.replace('?', `$${args.length}`)); };
  const q = req.query;
  if (q.grupo === 'abertos') where.push(`s.status IN ('ABERTO','AGUARDANDO')`);
  if (q.grupo === 'resolvidos') where.push(`s.status IN ('RECEBIDO','SEM_RETORNO','CANCELADO')`);
  if (q.status) add('s.status = ?', String(q.status));
  if (q.cliente) add('s.cliente ILIKE ?', `%${q.cliente}%`);
  if (q.produto_id) add('s.produto_id = ?', Number(q.produto_id));
  if (q.motivo_id) add('EXISTS (SELECT 1 FROM sac_motivos x WHERE x.sac_id = s.id AND x.motivo_id = ?)', Number(q.motivo_id));
  const campo = q.grupo === 'resolvidos' ? 's.data_conclusao' : 's.data_abertura';
  if (q.de) add(`${campo}::date >= ?::date`, String(q.de));
  if (q.ate) add(`${campo}::date <= ?::date`, String(q.ate));
  res.json(await sql(`${sqlSac()} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.numero DESC`, args));
});

app.get('/api/sacs/:id', async (req, res) => {
  const sac = await buscarSac(Number(req.params.id));
  const logs = await sql(`SELECT * FROM logs WHERE entidade = 'sac' AND entidade_id = $1 ORDER BY id`, [sac.id]);
  const movs = await sql(`SELECT m.*, u.nome AS usuario_nome FROM movimentacoes m JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.sac_id = $1 ORDER BY m.id`, [sac.id]);
  res.json({ ...sac, logs, movimentacoes: movs });
});

app.post('/api/sacs', async (req: Req, res) => {
  const u = usuario(req);
  const cliente = texto(req.body?.cliente, 'cliente')!.toUpperCase();
  const produtoId = Number(req.body?.produto_id);
  const quantidade = numero(req.body?.quantidade, 'Quantidade');
  const nfVenda = texto(req.body?.nf_venda, 'NF de venda', false);
  const obs = texto(req.body?.observacao, 'observação', false);
  // volta: 'sim' → a caminho | 'nao' → resolvido sem retorno | 'indefinido' → sem definição
  const volta: 'sim' | 'nao' | 'indefinido' = ['sim', 'nao'].includes(req.body?.volta) ? req.body.volta : 'indefinido';
  const resolucao = volta === 'nao' ? texto(req.body?.resolucao, 'o que aconteceu com o produto')! : null;
  const prod = await sql1('SELECT * FROM produtos WHERE id = $1 AND ativo = 1', [produtoId]) ?? falha(400, 'Selecione um produto');
  const id = await transacao(async () => {
    await sql('LOCK TABLE sacs IN SHARE ROW EXCLUSIVE MODE');
    const prox = (await sql1('SELECT COALESCE(MAX(numero),0)+1 AS n FROM sacs'))!.n as number;
    const t = agora();
    const status = volta === 'sim' ? 'AGUARDANDO' : volta === 'nao' ? 'SEM_RETORNO' : 'ABERTO';
    const r = (await sql1(`INSERT INTO sacs (numero, cliente, produto_id, quantidade, nf_venda, observacao, status, volta_fabrica,
      resolucao, data_abertura, data_modificacao, data_conclusao, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12) RETURNING id`,
      [prox, cliente, produtoId, quantidade, nfVenda, obs, status, volta === 'indefinido' ? null : volta === 'sim' ? 1 : 0,
        resolucao, t, volta === 'nao' ? t : null, u.id]))!;
    await salvarMotivos(r.id, req.body?.motivo_ids);
    const mot = (await buscarSac(r.id)).motivos;
    await registrarLog(u, 'sac', r.id, 'SAC aberto',
      `Cliente ${cliente} · ${quantidade} × ${prod.descricao} · Motivos: ${mot}${nfVenda ? ` · NF venda ${nfVenda}` : ''}`);
    if (volta === 'sim') await registrarLog(u, 'sac', r.id, 'Status alterado', 'Vai voltar → A caminho da fábrica');
    if (volta === 'nao') await registrarLog(u, 'sac', r.id, 'SAC concluído', `Não volta pra fábrica · ${resolucao}`);
    return r.id as number;
  });
  res.json(await buscarSac(id));
});

app.put('/api/sacs/:id', async (req: Req, res) => {
  const u = usuario(req);
  const at = await buscarSac(Number(req.params.id));
  if (!['ABERTO', 'AGUARDANDO'].includes(at.status)) falha(400, 'Só é possível editar SAC em aberto');
  const n = {
    cliente: texto(req.body?.cliente, 'cliente')!.toUpperCase(),
    quantidade: numero(req.body?.quantidade, 'Quantidade'),
    nf_venda: texto(req.body?.nf_venda, 'NF de venda', false),
    observacao: texto(req.body?.observacao, 'observação', false),
  };
  await transacao(async () => {
    await sql('UPDATE sacs SET cliente=$1, quantidade=$2, nf_venda=$3, observacao=$4, data_modificacao=$5 WHERE id=$6',
      [n.cliente, n.quantidade, n.nf_venda, n.observacao, agora(), at.id]);
    await salvarMotivos(at.id, req.body?.motivo_ids);
    const depois = await buscarSac(at.id);
    const mud = (Object.keys(n) as (keyof typeof n)[]).filter((k) => (at[k] ?? null) !== n[k]).map((k) => `${k}: ${at[k] ?? '—'} → ${n[k] ?? '—'}`);
    if (at.motivos !== depois.motivos) mud.push(`motivos: ${at.motivos} → ${depois.motivos}`);
    if (mud.length) await registrarLog(u, 'sac', at.id, 'SAC alterado', mud.join('; '));
  });
  res.json(await buscarSac(at.id));
});

app.post('/api/sacs/:id/volta', async (req: Req, res) => {
  const u = usuario(req);
  const s = await buscarSac(Number(req.params.id));
  if (s.status !== 'ABERTO') falha(400, 'Apenas SAC sem definição pode ser marcado como "vai voltar"');
  await sql(`UPDATE sacs SET status='AGUARDANDO', volta_fabrica=1, data_modificacao=$1 WHERE id=$2`, [agora(), s.id]);
  await registrarLog(u, 'sac', s.id, 'Status alterado', `${LABEL_STATUS.ABERTO} → ${LABEL_STATUS.AGUARDANDO}`);
  res.json(await buscarSac(s.id));
});

// Chegou na fábrica: entrada da nota → estoque aumenta
app.post('/api/sacs/:id/entrada', async (req: Req, res) => {
  const u = usuario(req);
  const s = await buscarSac(Number(req.params.id));
  if (!['ABERTO', 'AGUARDANDO'].includes(s.status)) falha(400, 'Esse SAC não está aguardando material');
  const nota = texto(req.body?.nota, 'nº da nota')!;
  const qtd = numero(req.body?.quantidade, 'Quantidade recebida');
  const dataEntrada = texto(req.body?.data, 'data de entrada')!;
  if (await sql1(`SELECT 1 FROM movimentacoes WHERE tipo='ENTRADA_SAC' AND estornada=0 AND nota=$1 AND produto_id=$2`, [nota, s.produto_id]))
    falha(400, `A nota ${nota} já foi lançada para esse produto`);
  await transacao(async () => {
    const t = agora();
    await sql(`INSERT INTO movimentacoes (produto_id, tipo, quantidade, nota, sac_id, data, usuario_id)
      VALUES ($1, 'ENTRADA_SAC', $2, $3, $4, $5, $6)`, [s.produto_id, qtd, nota, s.id, t, u.id]);
    await sql(`UPDATE sacs SET status='RECEBIDO', volta_fabrica=1, nf_entrada=$1, data_entrada=$2, qtd_recebida=$3,
      data_modificacao=$4, data_conclusao=$4 WHERE id=$5`, [nota, dataEntrada, qtd, t, s.id]);
    const dif = qtd - s.quantidade;
    await registrarLog(u, 'sac', s.id, 'Entrada da nota',
      `NF ${nota} · ${qtd} recebidos (previsto ${s.quantidade}${dif ? `, diferença ${dif > 0 ? '+' : ''}${dif}` : ''}) · estoque +${qtd}`);
    await registrarLog(u, 'sac', s.id, 'SAC concluído', `${LABEL_STATUS[s.status]} → ${LABEL_STATUS.RECEBIDO}`);
    await registrarLog(u, 'produto', s.produto_id, 'Entrada de estoque', `SAC ${s.numero} · NF ${nota} · +${qtd}`);
  });
  res.json(await buscarSac(s.id));
});

app.post('/api/sacs/:id/sem-retorno', async (req: Req, res) => {
  const u = usuario(req);
  const s = await buscarSac(Number(req.params.id));
  if (!['ABERTO', 'AGUARDANDO'].includes(s.status)) falha(400, 'Esse SAC já foi concluído');
  const resolucao = texto(req.body?.resolucao, 'o que aconteceu com o produto')!;
  const t = agora();
  await sql(`UPDATE sacs SET status='SEM_RETORNO', volta_fabrica=0, resolucao=$1, data_modificacao=$2, data_conclusao=$2 WHERE id=$3`, [resolucao, t, s.id]);
  await registrarLog(u, 'sac', s.id, 'SAC concluído', `${LABEL_STATUS[s.status]} → ${LABEL_STATUS.SEM_RETORNO} · ${resolucao}`);
  res.json(await buscarSac(s.id));
});

app.post('/api/sacs/:id/cancelar', async (req: Req, res) => {
  const u = usuario(req);
  const s = await buscarSac(Number(req.params.id));
  if (!['ABERTO', 'AGUARDANDO'].includes(s.status)) falha(400, 'Esse SAC já foi concluído');
  const motivo = texto(req.body?.motivo, 'motivo do cancelamento')!;
  const t = agora();
  await sql(`UPDATE sacs SET status='CANCELADO', resolucao=$1, data_modificacao=$2, data_conclusao=$2 WHERE id=$3`, [motivo, t, s.id]);
  await registrarLog(u, 'sac', s.id, 'SAC cancelado', motivo);
  res.json(await buscarSac(s.id));
});

// ---------------- Estoque ----------------
app.get('/api/estoque/movimentacoes', async (req, res) => {
  const pid = req.query.produto_id ? Number(req.query.produto_id) : null;
  res.json(await sql(`SELECT m.*, p.codigo AS produto_codigo, p.descricao AS produto_descricao, u.nome AS usuario_nome,
      s.numero AS sac_numero, s.cliente AS sac_cliente
    FROM movimentacoes m JOIN produtos p ON p.id = m.produto_id JOIN usuarios u ON u.id = m.usuario_id
    LEFT JOIN sacs s ON s.id = m.sac_id ${pid ? 'WHERE m.produto_id = $1' : ''} ORDER BY m.id DESC LIMIT 500`, pid ? [pid] : []));
});

const saldoDe = async (produtoId: number) =>
  (await sql1<{ s: number }>('SELECT COALESCE(SUM(quantidade),0) AS s FROM movimentacoes WHERE produto_id = $1', [produtoId]))!.s;

app.post('/api/estoque/ajuste', async (req: Req, res) => {
  const u = usuario(req);
  const produtoId = Number(req.body?.produto_id);
  if (!(await sql1('SELECT 1 FROM produtos WHERE id = $1', [produtoId]))) falha(400, 'Selecione um produto');
  const qtd = Number(String(req.body?.quantidade ?? '').replace(',', '.'));
  if (!Number.isFinite(qtd) || qtd === 0) falha(400, 'Informe a quantidade do ajuste (positiva para somar, negativa para tirar)');
  const motivo = texto(req.body?.motivo, 'motivo do ajuste')!;
  await transacao(async () => {
    const saldo = await saldoDe(produtoId);
    if (saldo + qtd < 0) falha(400, `O saldo ficaria negativo (saldo atual ${saldo})`);
    const r = (await sql1(`INSERT INTO movimentacoes (produto_id, tipo, quantidade, motivo, data, usuario_id)
      VALUES ($1, 'AJUSTE', $2, $3, $4, $5) RETURNING id`, [produtoId, qtd, motivo, agora(), u.id]))!;
    await registrarLog(u, 'produto', produtoId, 'Ajuste de estoque',
      `${qtd > 0 ? '+' : ''}${qtd} · ${motivo} · saldo ${saldo} → ${saldo + qtd} (mov. ${r.id})`);
  });
  res.json({ ok: true });
});

app.post('/api/estoque/movimentacoes/:id/estornar', async (req: Req, res) => {
  const u = usuario(req);
  const m = await sql1('SELECT * FROM movimentacoes WHERE id = $1', [Number(req.params.id)]) ?? falha(404, 'Movimentação não encontrada');
  if (m.tipo === 'ESTORNO') falha(400, 'Não é possível estornar um estorno');
  if (m.estornada) falha(400, 'Essa movimentação já foi estornada');
  const motivo = texto(req.body?.motivo, 'motivo do estorno')!;
  await transacao(async () => {
    const saldo = await saldoDe(m.produto_id);
    if (saldo - m.quantidade < 0) falha(400, `O saldo ficaria negativo (saldo atual ${saldo})`);
    const t = agora();
    await sql(`INSERT INTO movimentacoes (produto_id, tipo, quantidade, nota, sac_id, motivo, estorno_de, data, usuario_id)
      VALUES ($1, 'ESTORNO', $2, $3, $4, $5, $6, $7, $8)`, [m.produto_id, -m.quantidade, m.nota, m.sac_id, motivo, m.id, t, u.id]);
    await sql('UPDATE movimentacoes SET estornada = 1 WHERE id = $1', [m.id]);
    await registrarLog(u, 'produto', m.produto_id, 'Estorno de movimentação', `Mov. ${m.id} (${m.quantidade > 0 ? '+' : ''}${m.quantidade}) estornada · ${motivo}`);
    if (m.tipo === 'ENTRADA_SAC' && m.sac_id) {
      await sql(`UPDATE sacs SET status='AGUARDANDO', nf_entrada=NULL, data_entrada=NULL, qtd_recebida=NULL,
        data_conclusao=NULL, data_modificacao=$1 WHERE id=$2`, [t, m.sac_id]);
      await registrarLog(u, 'sac', m.sac_id, 'Entrada estornada', `NF ${m.nota} estornada (${motivo}) · Recebido na fábrica → A caminho da fábrica`);
    }
  });
  res.json({ ok: true });
});

// ---------------- Logs ----------------
app.get('/api/logs', async (req, res) => {
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (cond: string, ...vs: unknown[]) => {
    let c = cond;
    for (const v of vs) { args.push(v); c = c.replace('?', `$${args.length}`); }
    where.push(c);
  };
  const q = req.query;
  if (q.entidade) add('entidade = ?', String(q.entidade));
  if (q.entidade_id) add('entidade_id = ?', Number(q.entidade_id));
  if (q.texto) { const t = `%${q.texto}%`; add('(acao ILIKE ? OR detalhes ILIKE ? OR usuario_nome ILIKE ?)', t, t, t); }
  if (q.de) add('data::date >= ?::date', String(q.de));
  if (q.ate) add('data::date <= ?::date', String(q.ate));
  res.json(await sql(`SELECT * FROM logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 1000`, args));
});

app.use('/api', (_req, _res, next) => next(new ErroApp(404, 'Rota não encontrada')));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErroApp) return res.status(err.status).json({ erro: err.message });
  if (err instanceof ErroBanco) return res.status(503).json({ erro: err.message });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor' });
});

export default app;
