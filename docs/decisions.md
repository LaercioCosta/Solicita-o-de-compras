# Registro de Decisões

Todas as decisões relevantes do projeto. Fonte de truth nível 6 (ver Seção 3 da spec).

---

## DEC-001 — Stack de backend

- **Data:** 2026-09-24 (Fase 0)
- **Decisão:** NestJS + TypeScript
- **Tipo:** Aprovada pelo usuário
- **Motivo:** Escolha explícita do usuário no checkpoint de planejamento. Adequado para APIs estruturadas com guards de autorização por perfil.

## DEC-002 — Stack de frontend

- **Data:** 2026-09-24 (Fase 0)
- **Decisão:** React + Vite + Tailwind CSS
- **Tipo:** Aprovada pelo usuário
- **Motivo:** Escolha explícita do usuário. Ecossistema maduro para telas de dashboard/admin.

## DEC-003 — Banco de dados

- **Data:** 2026-09-24 (Fase 0)
- **Decisão:** MySQL (MariaDB compatível)
- **Tipo:** Aprovada pelo usuário
- **Motivo:** Escolha explícita do usuário.

## DEC-004 — Estratégia de deploy

- **Data:** 2026-09-24 (Fase 0)
- **Decisão:** Docker via docker-compose (local/VPS)
- **Tipo:** Aprovada pelo usuário
- **Motivo:** Escolha explícita do usuário. Entregável da Fase 9: Dockerfile, docker-compose.yml, .env.example, CI/CD, /docs/deployment.md.

## DEC-005 — ORM

- **Data:** 2026-09-24 (Fase 0)
- **Decisão:** Prisma
- **Tipo:** Decisão técnica de baixo impacto (Seção 32 — biblioteca equivalente)
- **Motivo:** Migrations versionadas, constraints declarativas, seeds reproduzíveis e client tipado. Alinha-se ao critério da Fase 3 (banco reproduzível do zero).
- **Impacto:** Nenhum sobre regras de negócio.

## DEC-006 — Nome e localização do projeto

- **Data:** 2026-09-24 (Fase 0)
- **Decisão:** `/home/laercio/projetos/compras` (monorepo: `docs/`, `backend/`, `frontend/`)
- **Tipo:** Aprovada pelo usuário
- **Motivo:** Escolha explícita do usuário.

## DEC-007 — Runtime Node.js no ambiente de desenvolvimento

- **Data:** 2026-09-24 (Fase 0)
- **Decisão:** Node.js v22 LTS instalado em `~/.local/node` (user-space), sem privilégios root. PATH registrado em `~/.bashrc`.
- **Tipo:** Decisão técnica de baixo impacto
- **Motivo:** Ambiente não dispõe de sudo não-interativo e não possui Docker. Instalação via tarball oficial do nodejs.org.
- **Pendência relacionada:** MySQL runtime para desenvolvimento local não disponível neste ambiente. A execução de migrations (Fase 3) exigirá MariaDB user-space, Docker na máquina do usuário, ou outra alternativa a decidir quando necessário.

## DEC-008 — Autenticação e autorização

- **Data:** 2026-09-24 (Fase 2)
- **Decisão:** JWT (access curto + refresh revogável), hash Argon2id; RBAC com guards NestJS + policy de posse/setor.
- **Tipo:** Técnica de baixo impacto (Seção 32)
- **Motivo:** Requisitos RNF-01; toda permissão vem da permission-matrix. Sem dependência de infraestrutura externa.
- **Impacto em regras de negócio:** nenhum (escopos seguem a matriz).

## DEC-009 — Armazenamento de documentos

- **Data:** 2026-09-24 (Fase 2)
- **Decisão:** Volume local (`/uploads`) com metadados na tabela `documentos`; nome randomizado no disco.
- **Tipo:** Técnica de baixo impacto
- **Motivo:** Simples e compatível com Docker. Migração para object storage (S3 etc.) fica como evolução.
- **Impacto em regras de negócio:** retenção/expurgo é pendência LGPD do checkpoint — não decidida aqui.

## DEC-010 — Estratégia de auditoria

- **Data:** 2026-09-24 (Fase 2)
- **Decisão:** Tabela `auditoria` append-only; escrita por service dedicado sem métodos de alteração/remoção.
- **Tipo:** Técnica de baixo impacto
- **Motivo:** CA-09. Integridade via código + constraints; access log de leitura pendente (escopo Admin).

## DEC-011 — Notificações

- **Data:** 2026-09-24 (Fase 2)
- **Decisão:** Notificação in-app na tabela `notificacoes` (sem e-mail no MVP).
- **Tipo:** Técnica de baixo impacto
- **Motivo:** RN-02 exige apenas que a TI seja notificada; e-mail é extensão futura.

---

## DEC-012 — Schema crítico do banco

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** Schema crítico APROVADO como está (commit f60b155), com um acréscimo decidido no checkpoint: itens estruturados na solicitação (ver DEC-025).
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário no checkpoint consolidado.
- **Impacto:** Schema validado como base da implementação; acréscimo de itens estruturados tratado em DEC-025.

## DEC-013 — Escopo do perfil Administrador (item 1)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** O Administrador gerencia **usuários** (criar/editar/vincular perfis e setores) e **setores**, e **LÊ a auditoria**. Nada mais: o Administrador NÃO cancela solicitações, NÃO aprova/reprova, NÃO vê solicitações/compras/pagamentos/documentos, NÃO altera permissões de perfis além do vínculo usuário↔perfil.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita (múltipla seleção) do usuário: "Gestão de usuários e setores" + "Leitura da auditoria".
- **Impacto:** `permission-matrix.md` (seção Administrador), `requirements.md` (atores, item 1 das pendências), RN-05, CA-09.3, CA-10, US-ADMIN.

## DEC-014 — Cancelamento de solicitações (P¹, item crítico)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Só solicitante, pré-fluxo": o Solicitante cancela apenas as **próprias** solicitações em **RASCUNHO** e **AGUARDANDO_CORRECAO**. Após entrar no fluxo de aprovação, **ninguém cancela** (usa-se reprovação/devolução). CANCELADO é alcançável somente a partir desses dois estados.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** RN-09, CA-12, RF-20, `permission-matrix.md` (células de cancelar), US-21.

## DEC-015 — Alteração relevante (item 2 — regra crítica)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Qualquer alteração" (interpretação conservadora). Codificação operacional mínima:
  - (a) editável livremente em RASCUNHO e AGUARDANDO_CORRECAO;
  - (b) em qualquer outro estado não-terminal (AGUARDANDO_APROVACAO_SETOR, AGUARDANDO_APROVACAO_FINANCEIRA, APROVADO, AGUARDANDO_TI, COMPRA_EM_ANDAMENTO, AGUARDANDO_FINANCEIRO, PAGO, AGUARDANDO_NF), **qualquer alteração em qualquer campo da solicitação, seus itens ou orçamentos** retorna o fluxo para AGUARDANDO_APROVACAO_SETOR com novo ciclo de aprovação (**cicloAprovacao + 1**);
  - (c) REPROVADO, CANCELADO e CONCLUIDO não são editáveis.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13) — o item (b) é codificação operacional mínima da decisão do usuário.
- **Motivo:** Resposta explícita do usuário: "Qualquer alteração" — conservador.
- **Impacto:** RN-07, CA-08, CA-13, RF-16, `permission-matrix.md` (células de edição).

## DEC-016 — Quem executa o pagamento (P⁴, item 7)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "A gerente financeira e outro usuario do financeiro com permissao para realizar pagamento." Codificação operacional mínima: novo perfil **FINANCEIRO**, cujo escopo é exclusivamente a fase financeira — visualizar solicitações a partir de AGUARDANDO_FINANCEIRO, executar pagamento, anexar/registrar comprovante. FINANCEIRO NÃO aprova/reprova solicitações e NÃO acessa auditoria. A Gerente Financeira também pode pagar. **Interpretação mínima derivada da resposta do usuário — ajustável.**
- **Tipo:** Codificação operacional mínima da decisão do usuário
- **Motivo:** Resposta customizada do usuário no checkpoint.
- **Impacto:** Novo perfil FINANCEIRO em `permission-matrix.md`, `requirements.md` (atores, item 7), RN-03, CA-05, US-11/US-12/US-18/US-19.

## DEC-017 — Visibilidade da Gerente Financeira (P²)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Todas, em qualquer estado": a Gerente Financeira visualiza TODAS as solicitações de todos os setores em qualquer estado (leitura global).
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** `permission-matrix.md` (GF.visualizar Solicitação), RN-12, `requirements.md` (atores).

## DEC-018 — Detalhes financeiros (P²)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Todos os envolvidos veem tudo": Solicitante, Gerente do setor, TI e pagadores veem valores e comprovantes das solicitações às quais já têm acesso pela matriz (próprias / do próprio setor / designadas à TI / fase financeira). Sem ocultação financeira por perfil.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** `permission-matrix.md` (células de Pagamento.visualizar), RN-12.

## DEC-019 — Aprovadores de Oficina e TI (item 8)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Gerente Financeira acumula": em Oficina e TI, a Gerente Financeira é também o aprovador de 1º nível; as duas aprovações (1º e 2º nível) ocorrem em sequência, registradas como decisões distintas por nível. GF não acumula o 1º nível em MKT e Comercial (gerentes próprios).
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** RN-02, `requirements.md` (tabela de setores, item 8), `permission-matrix.md` (GF.aprovar).

## DEC-020 — SLA de aprovação (item 3)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Lembrete in-app": sem timeout automático; após N dias sem decisão (N configurável; padrão 3 dias), o aprovador pendente recebe notificação de lembrete in-app. Nenhuma transição automática de estado.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** RN-08, RNF-08, notificações in-app (DEC-011).

## DEC-021 — Expiração de orçamento (item 4)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Opcional, sem bloqueio": campo de validade opcional nos orçamentos; sem bloqueio automático no MVP; a TI confere manualmente antes de comprar.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** RN-01, RN-08; campo de validade no schema tratado fora desta tarefa.

## DEC-022 — Concorrência em aprovação (item 5)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Garantia estrutural": uma única decisão por nível por ciclo de aprovação (constraint unique no banco, já presente no schema); segunda ação simultânea/duplicada recebe erro 409 e não é registrada como decisão.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** RN-08, CA-11.2.

## DEC-023 — Nota Fiscal (P⁵)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** A TI anexa a NF recebida da loja; o estado AGUARDANDO_NF é de responsabilidade da TI.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário: "TI".
- **Impacto:** RN-11, CA-06.3, RF-12, `permission-matrix.md` (TI.Documento.anexar), US-22.

## DEC-024 — Retenção LGPD (item 6)

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Auditoria permanente + NF 5 anos": auditoria retida por tempo indeterminado; NF e comprovantes retidos por 5 anos (prazo usual de guarda fiscal — a confirmar com a contabilidade da empresa); sem expurgo automático no MVP.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** RNF-03, RN-05, RN-08.

## DEC-025 — Estrutura da solicitação

- **Data:** 2026-09-25 (checkpoint humano — Seção 13)
- **Decisão:** "Itens estruturados": a solicitação carrega uma lista de itens (produto, quantidade, valor unitário estimado). Mantém também um campo de descrição textual (resumo/objetivo da compra). Codificação: descrição = resumo/objetivo; itens = detalhamento estruturado.
- **Tipo:** Aprovada pelo usuário (checkpoint Seção 13)
- **Motivo:** Resposta explícita do usuário.
- **Impacto:** RF-19, RN-10, US-20; acréscimo referido em DEC-012.

---

## Decisões do checkpoint humano (2026-09-25)

As pendências anteriormente listadas nesta seção foram todas respondidas pelo usuário no checkpoint consolidado (Seção 13, 2026-09-25) e registradas como DEC-012 a DEC-025:

1. Escopo do perfil **Administrador** → DEC-013
2. Definição objetiva de **alteração relevante** → DEC-015
3. **SLA/timeout de aprovação** → DEC-020
4. **Expiração/validade de orçamento** → DEC-021
5. **Concorrência em aprovação** → DEC-022
6. **Política de retenção de documentos e auditoria** (LGPD) → DEC-024

Adicionalmente resolvidos no mesmo checkpoint: schema crítico (DEC-012), cancelamento (DEC-014), quem paga (DEC-016), visibilidade da Gerente Financeira (DEC-017), detalhes financeiros (DEC-018), aprovadores de Oficina e TI (DEC-019), Nota Fiscal (DEC-023) e itens estruturados (DEC-025).

## DEC-026 — Escopo técnico do piloto MVP (Fase 3.5)

- **Data:** 2026-09-25 (Fase 3.5 — gate validado)
- **Decisão:** Encodings e deflavamentos adotados no piloto, sem alterar nenhuma regra de negócio aprovada:
  1. **Auth:** apenas access token JWT (15 min). O refresh token revogável da DEC-008 fica para a Fase 4.
  2. **Edição:** liberada somente em RASCUNHO/AGUARDANDO_CORRECAO (RN-07(a)). O reinício de ciclo pós-aprovação (RN-07(b), DEC-015) fica para a Fase 4 — no piloto a edição fora desses estados retorna 409.
  3. **Devolver para correção (CA-07/US-08):** endpoint fica para a Fase 4 (cenário de homologação 3, Fase 11).
  4. **SLA de lembrete (DEC-020):** job/notificação programada fica para a Fase 4.
  5. **Estados AGUARDANDO_TI e AGUARDANDO_NF:** definidos na máquina de estados, porém sem transições de entrada no piloto ("utilize, quando aplicável", Seção 8 da spec; os critérios CA-03/CA-05/CA-06 codificam APROVADO e PAGO diretamente).
  6. **Auditoria do envio de dados de pagamento pela TI:** codificada como `acao=COMPRAR, dados.etapa="envio_pagamento"` — o enum AcaoAuditoria mantém exatamente as 9 ações do CA-09; nenhuma ação nova foi criada sem decisão de negócio.
  7. **GET /api/notificacoes:** apenas autenticado, sem linha na tabela de permissões — notificação é dado privado do próprio usuário (DEC-011, natureza técnica).
  8. **Uploads:** validação básica (extensão pdf/png/jpg/jpeg, MIME coerente, ≤10MB, nome randomizado, sha256) conforme DEC-009/RNF-04; limites formais e hardening na Fase 8.
- **Tipo:** Decisão técnica de escopo do piloto (Seção 32 — Orquestrador), pendências encaminhadas às Fases 4 e 8
- **Motivo:** manter o piloto mínimo (Seção 14: "sem cenários avançados e funcionalidades secundárias") sem violar regras aprovadas.
- **Impacto:** Fase 4 (itens 1–4), Fase 8 (item 8); nenhum impacto sobre as DEC-012 a DEC-025.

## DEC-027 — Edição após a compra iniciada

- **Data:** 2026-09-25 (Fase 4 — conflito DEC-015 × compra 1:1 escalado ao usuário, Seção 13)
- **Decisão:** "Bloquear após compra iniciar" — a solicitação (e seus orçamentos) é editável/reaberta apenas até o estado APROVADO (inclusive AGUARDANDO_APROVACAO_SETOR, AGUARDANDO_APROVACAO_FINANCEIRA, APROVADO, AGUARDANDO_TI). A partir de **COMPRA_EM_ANDAMENTO** (e estados seguintes: AGUARDANDO_FINANCEIRO, PAGO, AGUARDANDO_NF), qualquer edição retorna **409** — se o que foi comprado precisa mudar, abre-se uma **nova solicitação**.
- **Tipo:** Aprovada pelo usuário (conflito registrado pelo Orquestrador na Fase 4)
- **Motivo:** a compra 1:1 por solicitação impede novo registro de compra após re-fluxo (deadlock detectado na TASK-045); preserva a integridade da compra e do pagamento já existentes; alteração de item comprado é uma nova necessidade de compra.
- **Impacto:** Delimita a RN-07(b)/DEC-015 ("qualquer alteração" vale apenas até a compra iniciar); atualiza CA-13 e a matriz (célula editar); REPROVADO/CANCELADO/CONCLUIDO e estados pós-compra retornam 409 na edição.

## DEC-028 — Justificativa técnica de cobertura (gate Fase 4)

- **Data:** 2026-09-25 (Fase 4 — TASK-047)
- **Cobertura medida (unit + e2e combinadas, provider v8, `npm run test:cov:all`):** geral 90,13% statements / 73,91% branches / 96,36% funções. Módulos críticos: aprovacoes 90,2% · auditoria 100% · auth 94,9% · notificacoes 92,9% · solicitacoes 93,8% · sla 89,5% · documentos 89,3% · pagamentos 87,7% · compras 88,5%.
- **Regras críticas:** 100% das regras de negócio (RN-01 a RN-12) e critérios de aceite (CA-01 a CA-13) possuem testes dedicados passando (inclui varredura de autorização por perfil × entidade × ação da matriz — 66 permissões + probes negativos).
- **Justificativa técnica (linhas não cobertas nos 3 módulos abaixo de 90%, Seção 15 "salvo justificativa técnica documentada"):**
  1. **Branches de defesa-profunda sombreadas pelo guard** — os services repetem checagens que o PermissionsGuard já bloqueia antes (ex.: `compras.service` L34 não-TI, `pagamentos.service` L106-108 não-pagador, `documentos.service` default do `podeAcessar` para ADMIN). Inalcançáveis via HTTP por construção (default-deny do guard); cobri-las exigiria unit tests com mock de Prisma testando implementação, não comportamento.
  2. **Invariantes da máquina de estados** — caminhos de erro que a sequência de transições inválida por hipótese (ex.: pagamento-dados sem compra em COMPRA_EM_ANDAMENTO; compra sem aprovação financeira em APROVADO).
  3. **Branches de corrida** — guardas otimistas `count === 0` e `catch` de rollback/remoção de arquivo em falha transacional, não determinísticos em teste.
- **Tipo:** Justificativa técnica documentada (Orquestrador, Seção 15 da spec)
- **Impacto:** Gate de cobertura da Fase 4 considerado ATINGIDO (regras críticas 100% testadas; geral ≥70% superado). A reavaliar na Fase 7 (QA) com testes negativos adicionais se necessário.

## DEC-029 — Restrições de rede do ambiente WSL Orca para validação UI (Fase 6)

- **Data:** 2026-09-26 (Fase 6 — TASK-063)
- **Constatações de ambiente (não são decisões de produto):**
  1. Processos iniciados por chamadas do agente (sessão Orca/WSL) têm sockets de escuta **inacessíveis a partir do Windows após ~1–3 min** ("janela de graça"), mesmo com `--host 0.0.0.0`; processos iniciados **antes da sessão atual** (backend :3000, MariaDB :3306) permanecem acessíveis indefinidamente. O caminho Windows→WSL usa o localhost forwarding do WSL — navegadores do desktop alcançam o backend diretamente em `localhost:3000`.
  2. Processos iniciados **via cron** sobrevivem às chamadas do agente (o cron roda fora da árvore de processos da sessão). Watchdog usado: `/tmp/opencode/vite-watchdog.sh` (removido ao final da validação).
  3. `pkill -f` com padrão presente na própria linha de comando do bash **mata a própria chamada** — usar padrões como `vite[.]js` ou kill em arquivo separado.
  4. O proxy do Vite resolve `localhost` para IPv4/IPv6 conforme o watcher; o backend binda `0.0.0.0` (TASK-062), o que atende tanto o proxy quanto o forwarding do WSL.
- **Impacto na validação:** o clique-a-clique completo na UI real é inviável além da janela de graça; a validação de Fase 6 usa: (a) fluxo completo 15/15 via HTTP real com payloads idênticos aos da UI (`scripts/fluxo-integracao.mjs`); (b) UI real no navegador para login, dashboard com dados reais, criação de solicitação e orçamentos persistidos; (c) fluxo UI completo via MSW (TASK-058).
- **Tipo:** registro de ambiente (Seção 28 — evidência/log relevante)

## DEC-030 — Servimento do frontend na produção

- **Data:** 2026-09-26 (Fase 9 — TASK-067)
- **Decisão:** Frontend compilado (Vite build) servido por **nginx** como SPA estática com proxy reverso `/api` → backend (`frontend/Dockerfile`, `frontend/nginx.conf`). Mesma topologia do dev (proxy do Vite); `BASE_URL='/api'` relativo funciona nos dois ambientes sem código condicional.
- **Tipo:** Técnica de baixo impacto (Seção 32 — pendência registrada em architecture.md "decidir na Fase 9")
- **Motivo:** separação de concerns padrão do compose (DEC-004); o backend permanece sem exposição direta ao usuário; `client_max_body_size 12m` acomoda uploads ≤10MB.
- **Impacto:** nenhum sobre regras de negócio; documentado em `/docs/deployment.md`.

## DEC-031 — Disposição dos achados da revisão da Fase 10

- **Data:** 2026-09-26 (Fase 10 — revisão §21; relatório completo na sessão/TASK-068/069)
- **Corrigidos (TASK-068/069, com testes):**
  - #1 CRÍTICO — itens em estados de reabertura retornavam 500 (updateMany não suporta nested writes); RN-07(b)/CA-13.1 restauradas + teste e2e (11b).
  - #2 ALTO — GERENTE vinculado a Oficina/TI podia aprovar o 1º nível (DEC-019) → bloqueado com 404 + teste (6b).
  - #4 MÉDIO — Swagger/OpenAPI público em produção → registrado apenas fora de NODE_ENV=production.
  - #5 MÉDIO — multipart sem limite de buffer → FileInterceptor com fileSize 12MB (alinhado ao nginx; o 400 do serviço para >10MB preserva o contrato testado).
  - #6 BAIXO — lembrete SLA suprimido após reabertura → ciclo integra a mensagem (dedupe por ciclo) + teste.
  - #7 BAIXO — corrida submeter×cancelar → guard otimista (updateMany + count) no padrão do codebase.
- **Aceitos formalmente (com justificativa):**
  - #3 MÉDIO — auditoria registrada fora da transação da ação: janela de falha (crash entre commit e INSERT) é estreita e mitigada estruturalmente pelo 409 de DEC-022 (retentativa de decisão/pagamento não duplica). Corrigir exige refactor tx-aware em ~12 call sites; registrado como pendência de hardening futura, sem violação de cenário feliz (CA-09.1 válido em execução normal).
  - #8 BAIXO — CA-02.6 fixava "403" para gerente de outro setor, enquanto CA-10.3 admite "403/404"; o código usa 404 (anti-enumeração, testado). Critérios alinhados: CA-02.6 agora diz "403/404 (política anti-enumeração — ver CA-10.3)".
  - #9 BAIXO — criarOrcamento em estados de reabertura devolve 409 (não reabre): imaterial pelo invariante 3-exatos/máx-3 (qualquer criação ali falharia com 422); codificação conservadora mantida.
  - #10 BAIXO — tokens em localStorage: DEC-008 satisfeita (refresh revogável + rotativo); nenhum documento exige cookie httpOnly. Recomendação registrada para ciclo futuro de hardening XSS.
- **Tipo:** Disposição de revisão (Orquestrador, §21) — correções via worktrees TASK-068/069
- **Impacto:** Gates §21: 0 críticos ✓, 0 vulnerabilidades críticas ✓, arquitetura consistente ✓, pendências relevantes resolvidas/aceitas com registro ✓.

## DEC-032 — Aceite formal: projeto declarado PRONTO

- **Data:** 2026-09-27 (checkpoint final — Seção 25 da spec)
- **Decisão:** o usuário declara o projeto **PRONTO**. DoD §25 verificada pelo
  Orquestrador com evidências: 100% do MVP implementado; fluxos críticos testados
  (201/201 testes; piloto e2e na stack real 15/15; modo BUILD com UI no navegador);
  0 bugs críticos e 0 bloqueadores; auditoria transacional (RN-05/CA-09.1 atômico);
  permissões e auditoria validadas (matriz varrida por perfil×entidade×ação);
  documentos validados (upload com magic bytes, retenção DEC-024 aplicada);
  deploy validado por partes contra a imagem mysql:8.4 exata (migrations, seed,
  npm ci com npm 10, CMD do container) — `docker compose up` end-to-end pendente
  apenas por ausência de Docker no ambiente (DEC-007), executável em qualquer
  máquina com Docker via `docs/deployment.md`.
- **Tipo:** Aprovada pelo usuário (resposta explícita "pronto")
- **Impacto:** encerramento do ciclo de desenvolvimento (fases 0–11 concluídas).
