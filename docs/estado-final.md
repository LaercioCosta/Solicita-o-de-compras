# Estado Final — Sistema de Compras — PRONTO (aceite formal 2026-09-27, DEC-032)

## O que o sistema é

Sistema de controle de solicitações de compra com fluxo de aprovação em duas etapas
(gerente do setor + gerente financeira), execução da compra pela TI e pagamento pelo
financeiro. Perfis: Solicitante, Gerente, Gerente Financeira, FINANCEIRO, TI e
Administrador (gestão de usuários/setores + leitura de auditoria — DEC-013). As regras
de negócio (RN-01 a RN-12) e os critérios de aceite (CA-01 a CA-13) estão aprovados em
`docs/business-rules.md`, `docs/acceptance-criteria.md` e `docs/decisions.md`.

## Stacks

- **Backend**: NestJS + TypeScript, Prisma (adapter MariaDB), banco MariaDB/MySQL (utf8mb4);
  testes e2e com HTTP real (Vitest) e cobertura v8.
- **Frontend**: React + Vite + Tailwind CSS; testes Vitest + MSW/jsdom; lint oxlint.
- **Deploy**: docker compose (MySQL 8.4 + backend com `prisma migrate deploy` no boot +
  nginx servindo a SPA com proxy `/api`); CI em `.github/workflows/ci.yml`.

## Fases com status

Todas as fases (0 a 11) estão **tecnicamente concluídas** (detalhes em
`docs/execution-plan.md`):

| Fase | Status |
|---|---|
| 0–3 (inicialização, requisitos, arquitetura, banco) | Concluídas; checkpoint respondido (DEC-012 a DEC-025) |
| 3.5 — Piloto MVP | Validado (TASK-043; escopo em DEC-026) |
| 4 — Backend | Concluída (TASK-040..048; cobertura justificada em DEC-028) |
| 5 — Frontend | Concluída (TASK-050..061) |
| 6 — Integração | Concluída (TASK-062/063; fluxo 15/15 na stack real) |
| 7 — QA | Concluída (TASK-065; `docs/qa-fase7.md`) |
| 8 — Segurança | Concluída (TASK-066; `docs/seguranca-fase8.md`) |
| 9 — DevOps | Concluída (TASK-067; `docs/deployment.md`) |
| 10 — Code review | Concluída (TASK-068/069; DEC-031) |
| 11 — Homologação | Concluída tecnicamente (6/6 aprovados; `docs/homologacao-fase11.md`) |

## Onde estão as evidências

- `docs/qa-fase7.md` — Fase 7 (QA): 100% dos cenários críticos com teste, 0 bugs
  críticos/altos; 199/199 testes na data do relatório (backend 98, frontend 101);
  cobertura backend 89,95% statements (justificativa DEC-028).
- `docs/seguranca-fase8.md` — Fase 8: checklist §19 integral; 0 vulnerabilidades
  críticas (`npm audit --omit=dev`); uploads endurecidos com magic bytes; secrets fora
  do código; retenção LGPD aplicada e documentada (DEC-024).
- `docs/homologacao-fase11.md` — Fase 11: 6/6 cenários aprovados na master integrada;
  suítes de regressão 201/201 (backend 100, frontend 101); fluxo integrado real 15/15
  (`scripts/fluxo-integracao.mjs`); auditoria, documentos e permissões validados.
- `docs/decisions.md` — DEC-001 a DEC-031 (regras de negócio, checkpoint DEC-012 a
  DEC-025, cobertura DEC-028, disposição da revisão DEC-031).
- `docs/execution-plan.md` — plano de desenvolvimento e estado consolidado das fases.

## Pendências humanas

1. **Aceite formal da homologação** (encerramento §25 — estado PRONTO): checkpoint
   final do usuário, ainda pendente (ver `docs/homologacao-fase11.md`).
2. **Validação de runtime do deploy em máquina com Docker**: o ambiente de
   desenvolvimento não dispõe de Docker; o runtime dos containers é `NÃO MEDIDO`
   neste ambiente (DEC-007/DEC-029). Tudo que é verificável sem Docker foi verificado
   (build, migrations, testes, sintaxe YAML — ver `docs/deployment.md`).

## Pendências de hardening aceitas (DEC-031)

1. **Auditoria registrada fora da transação da ação** (DEC-031 #3, MÉDIO): janela de
   falha estreita, mitigada estruturalmente pelo 409 de DEC-022 (retentativa não
   duplica decisão/pagamento). O refactor tx-aware está registrado como pendência de
   hardening e está sendo concluído na TASK-071.
2. **Tokens em localStorage** (DEC-031 #10, BAIXO): DEC-008 satisfeita (refresh
   revogável e rotativo); nenhum documento exige cookie httpOnly. Recomendação
   registrada para ciclo futuro de hardening XSS.

## Conclusão

Todas as fases do plano (0 a 11) foram tecnicamente concluídas com evidências
registradas. O projeto aguarda o aceite formal do usuário (Seção 25) para o
encerramento; as pendências acima estão formalmente aceitas ou documentadas.
