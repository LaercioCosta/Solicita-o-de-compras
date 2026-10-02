# Homologação — Fase 11 (2026-09-26)

Cenários obrigatórios (spec §22 + `acceptance-criteria.md`) executados na master
integrada (2aa242b + DEC-031), após as correções da revisão da Fase 10 (TASK-068/069).

## Execução dos cenários

| # | Cenário | Execução | Resultado |
|---|---|---|---|
| 1 | Compra aprovada completa | **Stack real** (`scripts/fluxo-integracao.mjs`: proxy → NestJS → MariaDB, cruzando ana/bruno/carla/davi/elisa): 15/15 passos. Persistência verificada no banco: CONCLUIDO · aprovações SETOR+FINANCEIRA vinculadas a orçamentos distintos (7419/7420) · compra com o orçamento da GF (7420) · pagamento BOLETO R$ 379,50 pelo FINANCEIRO · documentos COMPROVANTE_PAGAMENTO + NOTA_FISCAL · auditoria completa (CRIAR, SUBMETER, APROVAR×2, COMPRAR×2 [incl. envio_pagamento], PAGAR, CONCLUIR) | **APROVADO** |
| 2 | Solicitação reprovada | `aprovacoes.e2e-spec` 5: reprovação nível 1 → REPROVADO terminal; decisão posterior → 409; auditoria REPROVAR com orçamento vinculado | **APROVADO** |
| 3 | Correção e reprocessamento | `fluxo-completo.e2e-spec` 1–2: gerente devolve → AGUARDANDO_CORRECAO (auditoria); solicitante edita e ressubmete → AGUARDANDO_APROVACAO_SETOR, ciclo inalterado | **APROVADO** |
| 4 | Tentativa de acesso indevido | `autorizacao-matriz.e2e-spec` (varredura 66 células da matriz + probes 403/404) + `caminhos-erro` (não-TI em compra/pagamento, ADMIN fora do fluxo, downloads de não-envolvidos) + sonda 403 FINANCEIRO→aprovar (script cenário 1, passo 12) | **APROVADO** |
| 5 | Alteração relevante pós-aprovação | `fluxo-completo` 3–4 + `solicitacoes` 11/11b: qualquer alteração (descricao/itens) em estados de aprovação → AGUARDANDO_APROVACAO_SETOR com ciclo+1; re-aprovação completa exigida; a partir de COMPRA_EM_ANDAMENTO → 409 (DEC-027); terminais → 409 | **APROVADO** |
| 6 | Cancelamento pré-fluxo | `solicitacoes` 9/9b/9c: RASCUNHO → CANCELADO; AGUARDANDO_CORRECAO → CANCELADO com auditoria; estados de aprovação → 409 preservando estado; não-solicitante → 403; solicitação alheia → 404 | **APROVADO** |

## Critérios §22

- **6/6 cenários executados** (spec pede os 5 obrigatórios; o 6º cancelamento consta da tabela do acceptance-criteria) — **100% aprovados**;
- **0 bugs críticos** · **0 bloqueadores**;
- **Auditoria validada** (append-only; leitura exclusiva do ADMIN; todas as ações críticas registradas com autor/estados — verificado direto no banco no cenário 1);
- **Documentos validados** (comprovante + NF persistidos e visíveis aos envolvidos — DEC-018; uploads com allowlist+MIME+magic bytes+10MB);
- **Permissões validadas** (matriz varrida por perfil×entidade×ação com probes negativos; FINANCEIRO isolado à fase financeira; ADMIN restrito a gestão+auditoria).

## Suítes de regressão na master (evidência)

- Backend: `npm run test:cov:all` → **100/100** (14 arquivos; cobertura 89,31% statements — justificativa DEC-028).
- Frontend: `npm test` → **101/101** (15 arquivos) · `npm run lint` OK · `npm run build` OK.
- Fluxo integrado real: **15/15** (cenário 1, acima).

## Pendências formalmente aceitas (DEC-031)

Nenhum bloqueador. Pendências de hardening aceitas com registro: auditoria transacional (#3), tokens em localStorage (#10), nuance `criarOrcamento` (#9).

## Conclusão

**6/6 cenários aprovados.** A homologação técnica está concluída; o aceite formal do
usuário (encerramento §25 — PRONTO) é o checkpoint final pendente.

## Validação em modo BUILD (pós TASK-071/072/073 — 2026-09-26)

Sistema validado pelos **artefatos de produção** (como o Docker da Fase 9 roda):

- Backend: `nest build` → `node dist/main.js` (código final, com auditoria transacional TASK-071) — health OK.
- Frontend: `vite build` (tsc + bundle) → servido por `vite preview` com proxy `/api` (TASK-073; mesma topologia do nginx — DEC-030).
- **Fluxo completo 15/15** através do bundle de produção (proxy preview → backend dist → MariaDB; solicitação de validação removida do dev DB após o teste).
- **UI de produção renderizando no navegador real** (Brave/Windows via localhost forwarding): login completo "Entre com suas credenciais" renderizado pelo bundle compilado, screenshot capturado.
- Suítes finais na master: backend 100/100 (cobertura 89,37%), frontend 101/101, lint/build OK.

Ambiente WSL (DEC-007/DEC-029): runtime de containers permanece `NÃO MEDIDO` —
validar com `docker compose up -d --build` em máquina com Docker (docs/deployment.md).

## Validação do caminho de deploy sem Docker (TASK-074/075 — 2026-09-26)

O ambiente não tem Docker nem rootless viável (sem `newuidmap`/`newgidmap`, sem
sudo — sonda registrada; DEC-007). O caminho de deploy foi então simulado e
MEDIDO por partes, com os mesmos passos do container:

1. **Banco criado automaticamente + migrations do zero**: `CREATE DATABASE` vazio →
   `npx prisma migrate deploy` → *"All migrations have been successfully applied"*.
2. **Boot da API (CMD do container)**: `node dist/main.js` com env de produção →
   health 200, **401 sem token** (guard global), 31 rotas mapeadas. O fail-fast do
   `JWT_SECRET` foi demonstrado ao vivo: sem o secret o boot recusa (idêntico ao
   comportamento exigido pelo compose com `:?`).
3. **Seed + login real**: `npm run db:seed` idempotente no banco novo → login HTTP
   com JWT válido.
4. **Estágio `npm ci` dos Dockerfiles com o npm 10 real do node:22**: backend verde
   após correção `backend/.npmrc` (`legacy-peer-deps` — lock resolvido por npm 11/12
   tem peer ausente para npm 10; ver deployment.md); frontend verde sem ajustes.
   `prisma generate` + `nest build` + `vite build` OK a partir do lockfile.

Permanece `NÃO MEDIDO` apenas o `docker compose up -d --build` end-to-end (imagem
mysql:8.4, rede interna, healthchecks) — executável em qualquer máquina com Docker
seguindo `docs/deployment.md`. Todos os estágios componentes do container já estão
verificados individualmente contra as mesmas entradas.

## Validação contra MySQL 8.4 — a versão exata do compose (TASK-076 — 2026-09-27)

Todo o projeto foi desenvolvido/testado contra MariaDB 11.4 user-space (DEC-007);
o `docker-compose.yml` de produção usa **mysql:8.4**. Para eliminar essa variável
desconhecida, o MySQL Community **8.4.6** foi instalado em user-space (porta 3307,
mesmo método da DEC-007 — tarball oficial + libs extraídas de .deb sem root) e a
validação completa re-executada contra ele:

- `prisma migrate deploy` do zero → *"All migrations have been successfully applied"*;
- `npm run db:seed` idempotente (o seed confirma o passo de homologação do deployment.md);
- **Suíte completa backend: 100/100** (unit + e2e + varredura de autorização) contra
  8.4.6 — 89,37% statements. Nota: sem o seed a suíte falha (14 testes dependem dos
  dados base) — o mesmo comportamento do CI, que roda migrate → seed → testes;
- Boot + health/401/31 rotas: ver TASK-074 (idêntico em ambos os bancos).

Com isso, **todas as partes do `docker-compose.yml` estão medidas** — imagem do
banco (versão idêntica, migrations, seed, 100 testes), estágio `npm ci` com o npm 10
real, CMD do backend (migrate deploy → boot), env obrigatórios. O único passo não
executável neste ambiente permanece o `docker compose up` em si (orquestração de
container — rede interna/healthchecks), agora com risco residual mínimo.

O ambiente de validação MySQL foi removido após o teste (tarball, binários e
datadir); o MariaDB dev permanece como base de desenvolvimento (DEC-007).
