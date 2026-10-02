# Relatório QA — Fase 7 (2026-09-26)

Validação executada contra `docs/acceptance-criteria.md` (nunca contra a implementação).
Metodologia: matriz de rastreabilidade CA ↔ testes; lacunas viraram testes (TASK-065);
suítes completas executadas na master integrada (487ab26).

## Resultado dos gates (spec §18)

| Gate | Meta | Resultado |
|---|---|---|
| Cenários críticos com teste | 100% | **100%** (ver matriz) |
| Testes críticos passando | 100% | **100%** |
| Testes totais passando | ≥95% | **100%** — 199/199 (backend 98, frontend 101) |
| Bugs críticos / bloqueadores | 0 | **0** |
| Bugs altos não tratados | 0 | **0** |
| Lint + build | sem erro | **OK** (oxlint backend/frontend; tsc+vite build OK) |

Cobertura backend (provider v8): 89,95% statements / 75,84% branches — consistente com a justificativa técnica DEC-028 (ramos de defesa-profunda sombreados pelo guard default-deny e invariantes de máquina de estados).

## Matriz de rastreabilidade CA ↔ testes

Legenda: `sN` = teste N de `solicitacoes.e2e-spec`; `a` = `aprovacoes.e2e-spec`; `cp` = `compras-pagamentos.e2e-spec`; `fc` = `fluxo-completo.e2e-spec`; `am` = `autorizacao-matriz.e2e-spec`; `ce` = `caminhos-erro.e2e-spec`; `do` = `documentos-orcamento.e2e-spec`; `adm` = `admin.e2e-spec`; `db` = `db-integrity.spec`; `pil` = `piloto.e2e-spec`; `au` = `auditoria.spec`; `app` = `app.e2e-spec`. Frontend (MSW/jsdom): `fp` = fluxo-piloto-ui, `gu` = guards, etc.

| CA | Backend (e2e real: HTTP + MariaDB) | Frontend (UI/MSW) |
|---|---|---|
| CA-01.1-5 criação/submissão | s1, s3 (RN-01 link/3 orçamentos), s4, s5, s13 (auditoria) | nova-solicitacao, fp |
| CA-02.1-6 aprovação de setor | a1, a2 (outro setor 404/403), a5, a6, a7, a10 (auditoria c/ orçamento) | aprovacoes |
| CA-03.1-6 aprovação financeira | a3 (TI notificada), a4 (não notificada c/ 1 nível), a2 (403 demais), am | aprovacoes, fp (CA-03.5) |
| CA-04.1-4 compra TI | cp11 (orçamento da GF, 403 não-TI, 409 repetir), cp13 (TI não paga — RN-03), am-TI, pil | compras |
| CA-05.1-6 pagamento | cp12 (BOLETO+PIX), cp13 (GF e FINANCEIRO pagam — DEC-016), cp15 (comprovante em documentos/auditoria), s8 (FINANCEIRO não vê RASCUNHO), am-FINANCEIRO | pagamentos, fp |
| CA-06.1-3 conclusão | cp14 (NF → CONCLUIDO; sem comprovante → 422; não-TI → 403; repetir → 409) | compras, fp |
| CA-07.1-3 correção | fc1 (devolve → AGUARDANDO_CORRECAO + auditoria; 403/404), fc2 (ressubmete, ciclo inalterado) | acoes-solicitante |
| CA-08.1-3 / CA-13 alteração relevante | fc3 (PATCH reabre ciclo+1 e re-aprova), fc4, fc4b (DEC-027 → 409 pós-compra), s10, s11 | acoes-solicitante, detalhe-integracao |
| CA-09.1-3 auditoria | au (append-only), adm5 (leitura admin c/ filtros), adm4 (não-admin → 403) | admin/auditoria |
| CA-10.1-7 segurança/isolamento | app (401 global), am (varredura perfil×entidade×ação da matriz + probes negativos), ce, do2 (não-dono), adm6 (ADMIN fora do fluxo → 403) | guards, login |
| CA-10.4-5 upload/secrets | do5, cp13 (.exe → 400; >10MB → 400); secrets: ver § abaixo | — |
| CA-11.1-2 estados inválidos | db (constraint DEC-022), a8 (decisão simultânea → 409), a9 (orçamento de outra → 422, estado preservado), ce (estados errados → 409/404), a5 (decisão pós-terminal → 409) | — |
| CA-12.1-6 cancelamento | s9 (RASCUNHO), **s9b (AGUARDANDO_CORRECAO — TASK-065)**, **s9c (estados de aprovação → 409 — TASK-065)**, s6 (alheia → 404), s9 (GERENTE → 403), s9b (auditoria CANCELAR) | acoes-solicitante |
| Homologação 1-6 | pil/fc (c1), a5 (c2), fc1-fc2 (c3), am/ce (c4), fc3/fc4 (c5), s9/s9b/s9c (c6) | fp (c1) |

## Lacunas encontradas e tratadas nesta fase

1. **CA-12.2 e CA-12.3 sem teste específico** (cancelamento em `AGUARDANDO_CORRECAO` e rejeição nos estados de aprovação) → testes adicionados no TASK-065 (backend/test/solicitacoes.e2e-spec.ts 9b/9c); o afterAll do suite ganhou cleanup de `aprovacoes` (a 9c foi a primeira decisão criada pelo suite).
2. **Nenhuma outra lacuna**: PIX (cp12/cp382), dupla decisão (a8 + constraint db), FINANCEIRO isolamento (s8/am), ADMIN fora do fluxo (adm6) já cobertos.

## CA-10.5 — verificação de secrets (evidência, 2026-09-26)

- `git ls-files`: nenhum `.env` versionado; `.gitignore` cobre `.env*` (exceto `.env.example`).
- `backend/src`: `JWT_SECRET` é **fail-fast** (throw se ausente — auth.module/jwt-refresh); sem default inseguro.
- Varredura de padrões (secret/senha/password/api-key com valor literal) em `backend/src` e `frontend/src`: apenas strings de validação de UI.
- `.env.example` versionado contém apenas placeholders/credenciais de dev documentadas (`docs/dev-database.md`).

## Execuções de evidência

- Backend: `npm run test:cov:all` → 14 files / **98/98**; cobertura 89,95% statements.
- Frontend: `npm test` → 15 files / **101/101**; `npm run lint` OK; `npm run build` OK.
- Stack real (Fase 6, TASK-063): fluxo do piloto 15/15 via proxy + validação SQL (persistência, auditoria, vínculos) — ver `scripts/fluxo-integracao.mjs` e DEC-029.

## Conclusão

**FASE 7: CONCLUÍDA.** 100% dos cenários críticos possuem teste, 100% passando, 0 bugs críticos/altos. Próxima: Fase 8 (Segurança).
