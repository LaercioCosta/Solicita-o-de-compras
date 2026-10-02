# Deploy — Sistema de Compras (Fase 9, DEC-004)

Deploy reproduzível via `docker compose`. Migrations executam automaticamente no boot
do backend (`prisma migrate deploy`); a ordem de subida é orquestrada por healthchecks.

## Pré-requisitos

- Docker Engine + Compose v2
- Node.js 22 (apenas para seed opcional em homologação — ver abaixo)

## Passo a passo

1. **Variáveis de ambiente** — copie e ajuste (os segredos são obrigatórios; sem
   `JWT_SECRET` a API falha na inicialização por decisão de segurança — Fase 8):

   ```bash
   cp .env.example .env
   # edite: JWT_SECRET, MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD (nunca use os defaults em produção)
   ```

2. **Subir o ambiente:**

   ```bash
   docker compose up -d --build
   ```

   O compose: (a) cria o banco com usuário/senha do `.env`; (b) backend roda
   `prisma migrate deploy` e sobe a API em `HOST=0.0.0.0:3000`; (c) nginx serve a UI
   em `http://localhost:${FRONTEND_PORT:-8080}` com proxy `/api` → backend.

3. **Healthcheck / verificação:**

   ```bash
   docker compose ps                  # backend deve ficar healthy
   curl http://localhost:3000/api/health
   curl -I http://localhost:8080/     # UI (nginx)
   ```

## Seed (usuários de dev/homologação) — opcional

A imagem de produção não inclui o seed (usuários são criados pelo Administrador na
UI — DEC-013). Para ambientes de homologação com Node 22 no host:

```bash
cd backend
DATABASE_URL="mysql://compras:SENHA@localhost:3306/compras" npm ci
DATABASE_URL="mysql://compras:SENHA@localhost:3306/compras" npm run db:seed
```

O seed é idempotente (upsert) e cria os 7 usuários de teste com senha `SenhaDev123!`
(documentada em `backend/prisma/seed.ts`) — **troque as senhas antes de homologar**.

## Dados persistentes

| Volume | Conteúdo | Backup |
|---|---|---|
| `mysql-data` | banco completo | `docker exec compras-mysql sh -c 'exec mysqldump ...'` |
| `uploads-data` (`/app/uploads`) | documentos (NF, comprovantes, orçamentos) | cópia do volume; nomes no disco são UUIDs; metadados ficam no banco |

Retenção (LGPD, DEC-024): auditoria por tempo indeterminado; NF/comprovantes 5 anos;
**sem expurgo automático** — expurgo manual é procedimento documentado a cargo do
Administrador (leitura de auditoria — DEC-013).

## Topologia

```
navegador → nginx (:8080) ─┬─ /      → SPA estática (build Vite)
                           └─ /api/  → backend NestJS :3000 → MySQL :3306
```

DEC-030 (Fase 9): frontend servido pelo nginx com proxy reverso — mesma topologia do
dev (Vite proxy), `BASE_URL='/api'` relativo funciona nos dois ambientes sem código
condicional.

## CI

`.github/workflows/ci.yml`: a cada push/PR — backend (MySQL service + migrations +
seed + lint + testes e2e/unit + build) e frontend (lint + testes + build). O CI falha
se qualquer teste, migration ou build falhar; `JWT_SECRET` do CI é descartável e nunca
válido em produção.

## Limitações conhecidas do ambiente de desenvolvimento deste projeto

- A máquina de desenvolvimento (WSL) não tem Docker; a validação de runtime dos
  containers é feita na implantação. Tudo que é verificável sem Docker foi verificado
  (build, migrations, testes, sintaxe YAML) — o runtime do compose é `NÃO MEDIDO`
  neste ambiente (ver `docs/decisions.md` DEC-007/DEC-029).
- `docker-compose.yml` usa `:?` para obrigar segredos no `.env`; defaults existem
  apenas para usuário/nome do banco.

## Nota: `npm ci` e peerDependencies (TASK-075)

O `backend/package-lock.json` foi resolvido com npm 11/12 (sem auto-instalação de
peers). O npm 10 (que acompanha o Node 22 das imagens Docker e do CI) exige que
todos os peers estejam no lock — o peer `typescript ^5.0.0` do `tsconfck`
(transitivo) não está, e o `npm ci` abortaria o build da imagem. O
`backend/.npmrc` com `legacy-peer-deps=true` faz qualquer npm instalar
exatamente o lockfile versionado. Validado com o npm 10 real em 2026-09-26:
`npm ci` + `prisma generate` + `nest build` verdes (worktree TASK-075).
