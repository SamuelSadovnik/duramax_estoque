# Duramax · Estoque SAC

Controle do **estoque originado de SAC** da Duramax Tintas & Vernizes. O SAC é só a porta de entrada:
cada material devolvido fica **sem definição**, **a caminho da fábrica** ou **em estoque** (quando chega e a nota é lançada).

- Front-end: React + Vite + TypeScript
- Back-end: Node.js + Express + TypeScript
- Banco: Postgres (Neon na Vercel) · no computador local usa PGlite (Postgres embutido, sem instalar nada)

## Publicar na Vercel
1. Na Vercel: **Add New → Project** e importe este repositório (as configurações já estão no `vercel.json`).
2. No projeto: **Storage → Create Database → Neon (Postgres)** e conecte ao projeto. A Vercel cria a variável `DATABASE_URL` sozinha.
   - Se a Vercel disser que `DATABASE_URL` já existe, apague essa variável em Environment Variables (ela veio do `.env.example`) e conecte de novo.
3. Faça **Redeploy**. As tabelas são criadas no primeiro acesso.
4. Para conferir, abra `https://SEU-SITE.vercel.app/api/saude` — deve mostrar `"ok": true`.
5. Entre com **admin / admin123**. O sistema obriga a criar uma senha nova nesse primeiro acesso.

## Rodar no computador
Requisito: Node.js 22 ou mais novo (LTS) (https://nodejs.org).

```bash
npm install
npm run dev      # front em http://localhost:5173 (API em :3000)
```
No Windows também dá pra usar `instalar.bat` e depois `iniciar.bat` (abre em http://localhost:3000).
Sem `DATABASE_URL`, os dados ficam na pasta `data/`. Para usar o mesmo banco da Vercel, crie um `.env` a partir do `.env.example`.

## Fluxo
1. **Lançar SAC**: cliente, produto, quantidade, motivo e **"Vai voltar pra fábrica?"** (Sim / Não / Ainda não sei).
   - Sim → *a caminho* · Não → descreve o que aconteceu e o SAC fecha na hora · Ainda não sei → *sem definição*.
2. **SACs em aberto**: quando o material chegar, clique em **Chegou**, informe a nota e a quantidade → o estoque sobe.
3. **Estoque**: em estoque / a caminho / sem definição por produto, com todas as movimentações.
4. **SACs resolvidos**: histórico com filtros e exportação para Excel.
5. **Histórico / Logs**: tudo que foi feito, por quem e quando (abertura, modificação, conclusão, estornos).

O saldo nunca é digitado: é a soma das movimentações (entradas de SAC, ajustes e estornos).
Lançou errado? Use **Estornar**: nada é apagado, tudo fica no histórico.

## Segurança
- Senhas guardadas com scrypt (nunca em texto). Mínimo 8 caracteres com letras e números; senhas comuns são recusadas.
- Senha criada ou redefinida pelo administrador é provisória: a pessoa cria a própria no primeiro acesso.
- 5 senhas erradas seguidas bloqueiam o usuário por 15 min; no máximo 30 tentativas por IP a cada 15 min.
- Sessão em cookie HttpOnly + SameSite=Strict (o JavaScript da página não lê o token); no banco fica só o hash do token.
- Sessão expira com 12 h sem uso ou 7 dias no máximo. Trocar a senha desconecta os outros computadores.
- Proteção contra CSRF, cabeçalhos de segurança (CSP, HSTS, X-Frame-Options) e registro de logins e falhas no Histórico.
