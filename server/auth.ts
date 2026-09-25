import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/*
 * Senhas: scrypt (N=2^15, r=8, p=1) com sal aleatório de 16 bytes.
 * Formato: scrypt$N$r$p$sal$hash   (o formato antigo "sal:hash" ainda é aceito e é atualizado no próximo login)
 */
const N = 1 << 15, R = 8, P = 1, TAM = 64;
const MAXMEM = 64 * 1024 * 1024;

export function hashSenha(senha: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(senha.normalize('NFKC'), sal, TAM, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export function conferirSenha(senha: string, guardado: string): boolean {
  try {
    if (guardado.startsWith('scrypt$')) {
      const [, n, r, p, sal, hash] = guardado.split('$');
      const esperado = Buffer.from(hash, 'base64');
      const teste = scryptSync(senha.normalize('NFKC'), Buffer.from(sal, 'base64'), esperado.length,
        { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
      return timingSafeEqual(esperado, teste);
    }
    const [sal, hash] = guardado.split(':'); // formato antigo
    if (!sal || !hash) return false;
    const esperado = Buffer.from(hash, 'hex');
    const teste = scryptSync(senha, sal, 64);
    return esperado.length === teste.length && timingSafeEqual(esperado, teste);
  } catch { return false; }
}

/** true se o hash guardado usa parâmetros antigos e deve ser refeito */
export const precisaRehash = (guardado: string) => !guardado.startsWith(`scrypt$${N}$${R}$${P}$`);

/** Hash de uma senha que não existe — usado para o tempo de resposta ser igual quando o usuário não existe */
export const HASH_FALSO = hashSenha(randomBytes(12).toString('hex'));

const FRACAS = new Set(['admin123', '12345678', '123456789', '1234567890', 'password', 'senha123', 'duramax', 'duramax123', 'qwerty123', 'abc12345', '00000000', '11111111']);

/** Regras de senha. Devolve a mensagem de erro, ou null se estiver ok */
export function validarSenha(senha: string, login?: string, nome?: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (senha.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) return 'A senha precisa ter letras e números.';
  const s = senha.toLowerCase();
  if (FRACAS.has(s)) return 'Essa senha é muito comum. Escolha outra.';
  if (login && s.includes(login.toLowerCase())) return 'A senha não pode conter o login.';
  const primeiroNome = nome?.split(/\s+/)[0]?.toLowerCase();
  if (primeiroNome && primeiroNome.length >= 3 && s.includes(primeiroNome)) return 'A senha não pode conter o seu nome.';
  if (/^(.)\1+$/.test(senha)) return 'A senha não pode ser um caractere repetido.';
  return null;
}

/** Token de sessão: 32 bytes aleatórios. No banco fica só o SHA-256 dele. */
export const novoToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
