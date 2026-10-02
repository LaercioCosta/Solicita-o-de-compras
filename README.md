# Sistema de Compras

Sistema de controle de solicitações de compra com fluxo de aprovação em duas etapas
(gerente do setor + gerente financeira), execução pela TI e pagamento pelo financeiro.

Estado do projeto: **todas as fases (0 a 11) tecnicamente concluídas com evidências** —
resumo em [docs/estado-final.md](docs/estado-final.md), plano em
[docs/execution-plan.md](docs/execution-plan.md). Orquestração do desenvolvimento:
ver [docs/orchestrator-spec.md](docs/orchestrator-spec.md).

## Stack

- Backend: NestJS + TypeScript, Prisma (adapter MariaDB)
- Frontend: React + Vite + Tailwind CSS
- Banco: MariaDB 11.4 user-space no dev (compatível MySQL); MySQL 8.4 via Docker no deploy
- Deploy: docker compose (MySQL + backend + nginx/SPA) e CI (`.github/workflows/ci.yml`)

## Estrutura

```
compras/
├── .github/workflows/ci.yml      # CI: push/PR → lint + testes + build (backend e frontend)
├── docs/                         # documentação e source of truth do projeto
├── backend/                      # API NestJS (Prisma; testes e2e/unit)
├── frontend/                     # SPA React (Vite; testes Vitest/MSW)
├── scripts/fluxo-integracao.mjs  # validação do fluxo fim a fim na stack real
└── docker-compose.yml            # deploy (MySQL + backend + nginx)
```

## Desenvolvimento (DEV)

1. Copie `.env.example` para `.env` e ajuste os valores (`JWT_SECRET` é obrigatório —
   sem ele a API falha na inicialização).
2. Suba o banco:
   - **Sem Docker/sudo (procedimento desta máquina)**: MariaDB user-space em
     `~/.local/mariadb` — siga [docs/dev-database.md](docs/dev-database.md)
     (banco `compras`, usuário `compras`, senha `compraspass`, porta 3306 em `127.0.0.1`).
   - **Com Docker**: `docker compose up -d mysql`
3. Backend: `cd backend && npm install && npm run start:dev`
4. Frontend: `cd frontend && npm install && npm run dev`

Health check: `GET http://localhost:3000/api/health`

## Testes

- **Backend** (unit + e2e com HTTP real — **exige banco rodando** na porta 3306,
  MariaDB user-space ou Docker):
  `cd backend && npm run test:cov:all`
- **Frontend** (Vitest + MSW/jsdom, não exige banco):
  `cd frontend && npm test`
- Lint e build em `backend/` e `frontend/`: `npm run lint` e `npm run build`
- Fluxo integrado na stack real (backend + frontend/proxy + banco rodando):
  `node scripts/fluxo-integracao.mjs` (15 passos, perfis cruzados — ver DEC-029)
- **Validação do build de produção local** (bundle + proxy, sem Docker):
  `cd frontend && npm run build && npm run preview` → UI em
  `http://localhost:4173` com `/api` no backend (mesma topologia do nginx — DEC-030)

## Deploy

1. Copie `.env.example` para `.env` e defina os segredos: `JWT_SECRET`,
   `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` (sem `JWT_SECRET` a API falha — Fase 8).
2. `docker compose up -d --build` — migrations executam automaticamente no boot do
   backend (`prisma migrate deploy`); healthchecks orquestram a ordem de subida.
3. Verificação: UI em `http://localhost:${FRONTEND_PORT:-8080}` (nginx) e
   `curl http://localhost:3000/api/health`.

Passo a passo completo, seed opcional de homologação, volumes/backup e retenção LGPD:
[docs/deployment.md](docs/deployment.md). Nota: o ambiente de desenvolvimento deste
projeto não tem Docker — o runtime dos containers é `NÃO MEDIDO` aqui e deve ser
validado na implantação.
