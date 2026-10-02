# Plano de Desenvolvimento — Sistema de Compras

Orquestração conforme `/docs/orchestrator-spec.md` v3.0.

## Equipe (mapeamento de papéis)

Os papéis da Seção 1 são operados pelo Orquestrador e seus subagentes dentro da mesma sessão. Por isso, as regras de isolamento da Seção 4 são disciplina de processo e a verificação mecânica da Seção 4.1 é obrigatória a cada tarefa.

| Papel | Responsabilidade | Execução |
|---|---|---|
| PO/BA | requisitos, processos, regras de negócio | delegação com Context Pack |
| ARQUITETO | arquitetura e decisões técnicas | delegação com Context Pack |
| DBA | schema, migrations, integridade | delegação com Context Pack |
| BACKEND | APIs, regras, autorização | delegação com Context Pack |
| FRONTEND/UI | interface, fluxos, UX | delegação com Context Pack |
| QA | testes, validação, regressão | delegação com Context Pack |
| SECURITY | segurança, uploads, exposição | delegação com Context Pack |
| DEVOPS | Docker, CI/CD, deploy | delegação com Context Pack |
| CODE REVIEWER | revisão técnica | delegação com Context Pack |

## Fases e gates

| Fase | Entrega | Gate de saída (DoD) | Estado (2026-09-26) |
|---|---|---|---|
| 0 — Inicialização | monorepo, stack, ambiente, planos | projeto inicia sem erro crítico | Concluída |
| 1 — Requisitos | /docs/requirements.md, business-rules.md, user-stories.md, acceptance-criteria.md, permission-matrix.md | perfis 100% definidos; regras testáveis; pendências do checkpoint marcadas como PENDENTE_DE_DECISAO | Concluída |
| 2 — Arquitetura | /docs/architecture.md, decisions.md (completado) | nenhuma decisão técnica crítica pendente | Concluída |
| 3 — Banco | Prisma schema, migrations, seeds | migrations do zero; integridade validada; testes básicos | Concluída (MariaDB user-space — docs/dev-database.md) |
| **CHECKPOINT (Seção 13)** | validação humana consolidada | **bloqueia implementação dependente** | Respondido (DEC-012 a DEC-025) |
| 3.5 — Piloto MVP | fluxo mínimo fim a fim | 100% do cenário validado antes das fases 4–11 | Concluída (TASK-043; escopo em DEC-026) |
| 4 — Backend | APIs completas | cobertura ≥90% crítico / ≥70% geral | Concluída (TASK-040..048; DEC-028) |
| 5 — Frontend | telas e fluxos | fluxo MVP completo; UX sem bloqueios | Concluída (TASK-050..061) |
| 6 — Integração | fluxo completo validado | persistência, status, permissões, auditoria | Concluída (TASK-062/063 — 15/15 na stack real) |
| 7 — QA | testes unit/E2E/regressão | ≥95% passando; 0 críticos | Concluída (TASK-065 — docs/qa-fase7.md) |
| 8 — Segurança | validação de segurança + LGPD | 0 vulnerabilidades críticas | Concluída (TASK-066 — docs/seguranca-fase8.md) |
| 9 — DevOps | Docker, CI/CD, deployment.md | deploy reproduzível | Concluída (TASK-067 — docs/deployment.md) |
| 10 — Code review | revisão 100% do crítico | 0 problemas críticos | Concluída (TASK-068/069 — DEC-031) |
| 11 — Homologação | 5 cenários obrigatórios | 5/5 aprovados | Concluída (6/6 aprovados — docs/homologacao-fase11.md) |

## Estado do projeto (atualizado em 2026-09-26 — TASK-072)

Todas as fases (0 a 11) estão **tecnicamente concluídas**, com evidências registradas
nos relatórios de fase e em `docs/decisions.md`. O resumo executivo de encerramento
está em `docs/estado-final.md`.

- **Fases 0–3**: concluídas (monorepo/stack, requisitos, arquitetura, banco via MariaDB user-space).
- **CHECKPOINT (Seção 13)**: respondido pelo usuário; respostas consolidadas em DEC-012 a DEC-025.
- **3.5 — Piloto MVP**: validado (TASK-043); escopo técnico em DEC-026.
- **4 — Backend**: concluída (TASK-040..048); cobertura justificada em DEC-028.
- **5 — Frontend**: concluída (TASK-050..061).
- **6 — Integração**: concluída (TASK-062/063); fluxo do piloto 15/15 na stack real (proxy → NestJS → MariaDB; DEC-029).
- **7 — QA**: concluída (TASK-065; `docs/qa-fase7.md`): 100% dos cenários críticos com teste, 0 bugs críticos/altos; 199/199 testes na data do relatório.
- **8 — Segurança**: concluída (TASK-066; `docs/seguranca-fase8.md`): 0 vulnerabilidades críticas; altas com tratamento documentado; retenção LGPD aplicada (DEC-024).
- **9 — DevOps**: concluída (TASK-067; `docs/deployment.md`); runtime dos containers `NÃO MEDIDO` neste ambiente (sem Docker).
- **10 — Code review**: concluída (TASK-068/069); 0 problemas críticos; disposição dos achados em DEC-031.
- **11 — Homologação**: concluída tecnicamente — 6/6 cenários aprovados (`docs/homologacao-fase11.md`); suítes de regressão 201/201 na master integrada (backend 100, frontend 101); o aceite formal do usuário (Seção 25) é o checkpoint final pendente.

## Processo por tarefa

1. Tarefa criada no formato da Seção 26 (TASK_ID, Context Pack, critérios, TENTATIVA_ATUAL 1/3)
2. Delegação ao papel adequado com contexto mínimo
3. Resposta no formato da Seção 27 com evidências
4. Verificação mecânica de vazamento (Seção 4.1) — bloqueia conclusão se confirmado
5. Testes executados; regressões verificadas
6. Integração + commit rastreável (Seção 30)
7. Relatório de ciclo (Seção 35)

## Limitações conhecidas do ambiente

- Node.js v22 em `~/.local/node` (sem sudo). PATH em `~/.bashrc`.
- Sem Docker neste ambiente. `docker-compose.yml` é entregável de deploy (Fase 9); o runtime dos containers é `NÃO MEDIDO` neste ambiente (ver `docs/deployment.md`). O desenvolvimento usou a alternativa MariaDB user-space (ver `docs/dev-database.md`), que viabilizou as Fases 3 a 11.
