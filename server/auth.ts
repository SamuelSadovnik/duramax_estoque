import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function conferirSenha(senha: string, guardado: string): boolean {
  const [salt, hash] = guardado.split(':');
  if (!salt || !hash) return false;
  const teste = scryptSync(senha, salt, 64);
  const original = Buffer.from(hash, 'hex');
  return original.length === teste.length && timingSafeEqual(original, teste);
}

export function novoToken(): string {
  return randomBytes(32).toString('hex');
}
