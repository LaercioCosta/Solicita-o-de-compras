# Orquestrador Operacional (enxuto) — Sistema de Compras

Documento de uso diário. A especificação de referência completa está em
`docs/orchestrator-spec.md` (v3.0) — consulte-a para qualquer ponto que não
estiver aqui.

---

## Ciclo (spec §2)

```text
ANALISAR → DIVIDIR → DELEGAR → IMPLEMENTAR → REVISAR → TESTAR → CORRIGIR → VALIDAR → INTEGRAR
```

"Tarefa concluída" não é evidência. Exija evidências verificáveis (spec §28).

## Source of Truth (spec §3)

1. decisões aprovadas pelo usuário → 2. business-rules.md → 3. permission-matrix.md
→ 4. acceptance-criteria.md → 5. architecture.md → 6. decisions.md → 7. implementação
→ 8. suposição de agente.

Código existente **não** sobrescreve regra de negócio. Conflito: identifique,
registre, peça decisão — não escolha arbitrariamente.

## Formato de tarefa (spec §26)

```text
TASK_ID:
FASE:
AGENTE:
OBJETIVO:
CONTEXT_PACK: (documentos permitidos, dependências, arquivos relevantes, regras aplicáveis, fora do escopo)
ENTREGÁVEIS:
CRITÉRIOS_DE_ACEITE:
MÉTRICAS_DE_CONCLUSÃO:
ARQUIVOS_ENVOLVIDOS:
WORKTREE: .worktrees/<TASK_ID> (branch: task/<TASK_ID>)
TENTATIVA_ATUAL: 1/3
STATUS:
```

## Resposta obrigatória do agente (spec §27)

```text
TASK_ID: / STATUS: / EXECUTADO: / ENTREGÁVEIS:
CRITÉRIOS: X/Y atendidos
TESTES: X/Y passando
MÉTRICAS: cobertura, testes, critérios
ARQUIVOS ALTERADOS: / EVIDÊNCIAS: / PROBLEMAS: / PENDÊNCIAS:
VAZAMENTO_DE_CONTEXTO (autorreporte): SIM/NÃO
CONTEXTO_ADICIONAL_UTILIZADO: [exato, se houver]
WORKTREE_UTILIZADO: [confirme que nenhuma escrita ocorreu fora dele]
```

## Verificação mecânica de vazamento (spec §4.1) — obrigatória, trava conclusão

Após cada resultado, o Orquestrador compara tudo que o agente citou contra o
Context Pack original. Item citado fora do contexto = vazamento **mesmo se o
autorreporte disser NÃO** → REJEITAR → REDELEGAR COM CONTEXTO CORRETO. Tarefa
com vazamento confirmado **não** recebe `STATUS: CONCLUÍDA`, sem exceção.

## Worktrees (spec §4.2) — obrigatórios para toda tarefa de código

```bash
git worktree add .worktrees/<TASK_ID> -b task/<TASK_ID> <base>
```

- Um worktree por TASK_ID; nunca reutilizar entre tarefas.
- Escrita apenas dentro do worktree designado.
- Merge somente após verificação mecânica (4.1) + testes + review.
- Rejeição (até 3 tentativas): reaproveitar o mesmo worktree.
- Remover o worktree somente após merge validado.
- Nunca editar a branch de integração fora de worktree dedicado.

## Checkpoint humano (spec §13) — itens que exigem decisão do usuário

Schema crítico · escopo do Administrador · alteração relevante · regras com
dinheiro · quem aprova cada etapa · autorização de pagamento · migrations
destrutivas · retrabalho > 1 fase · SLA de aprovação · expiração de orçamento ·
concorrência em aprovação · retenção LGPD.

Status do projeto: checkpoint consolidado **respondido** (DEC-012 a DEC-025,
2026-09-25). Novos conflitos de mesmo impacto voltam ao checkpoint; decisões
técnicas de baixo impacto não interrompem o usuário (spec §32).

## Regras que não podem ser violadas

- Não inventar: requisito, permissão, usuário, aprovação, valor, resultado de
  teste, cobertura, evidência, decisão do usuário (spec §34).
- Métrica não mensurável = `NÃO MEDIDO` (spec §28).
- Máximo **3 tentativas** de correção por tarefa; depois escala para humano
  (spec §33).
- Não avançar de fase com critério obrigatório pendente ou regressão conhecida
  (spec §24, §30, §36).
- A interface não é a única camada de segurança (spec §16).
- Não versionar secrets nem arquivos temporários (spec §30).
- DoD de tarefa/fase/projeto: spec §23, §24, §25.

## Fases (spec §9–§22)

0 Inicialização · 1 Requisitos · 2 Arquitetura · 3 Banco · 3.5 Piloto (gate) ·
4 Backend · 5 Frontend · 6 Integração · 7 QA · 8 Segurança · 9 DevOps ·
10 Code review · 11 Homologação (5 cenários obrigatórios).

Avanço de fase: PRÉ-REQUISITOS → DEPENDÊNCIAS → CHECKPOINTS → CRITÉRIOS DA FASE
ANTERIOR → LIBERAÇÃO (spec §36).
