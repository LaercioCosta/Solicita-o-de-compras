# Arquitetura — Sistema de Compras

Decisões técnicas derivadas da spec v3.0, `/docs/requirements.md`, `/docs/business-rules.md` e `/docs/permission-matrix.md`. Decisões relevantes registradas em `/docs/decisions.md`. Pendências de negócio não são decididas aqui.

## 1. Visão geral

```
┌──────────────┐      HTTPS/JSON       ┌──────────────────┐      SQL      ┌─────────┐
│   Frontend   │ ────────────────────► │   Backend NestJS │ ────────────► │  MySQL  │
│ React+Vite   │   /api (proxy Vite)   │   REST /api/*    │   Prisma      │         │
└──────────────┘                       └────────┬─────────┘               └─────────┘
                                                │
                                         arquivos em volume local (uploads/)
```

- **Frontend:** SPA React + Vite + Tailwind. Comunica-se apenas com a API. Não é camada de segurança (Seção 16 da spec).
- **Backend:** NestJS modular, REST sob prefixo `/api`. Autorização aplicada em guards/policies no backend.
- **Banco:** MySQL via Prisma ORM (DEC-005).
- **Documentos:** armazenados em volume local (`/uploads`); metadados (nome, tipo, tamanho, hash, dono, entidade vinculada) na tabela `documentos` (DEC-009). Política de retenção (LGPD, DEC-024): **auditoria retida por tempo indeterminado; NF e comprovantes retidos por 5 anos** (prazo usual de guarda fiscal — a confirmar com a contabilidade); **sem expurgo automático no MVP**. Acesso a documentos: somente envolvidos com permissão de leitura na matriz (policy de posse/setor/fase validada nos e2e); arquivos servidos sempre como `Content-Disposition: attachment` com nome randomizado no disco (sem execução inline).

## 2. Módulos do backend

| Módulo | Responsabilidade |
|---|---|
| `auth` | login, emissão/renovação de tokens, hash de senha |
| `usuarios` | CRUD de usuários (escopo de administração `PENDENTE_DE_DECISAO`) |
| `setores` | setores e vínculo de aprovação |
| `solicitacoes` | ciclo de vida da solicitação e transições de estado |
| `orcamentos` | orçamentos por solicitação (link da loja obrigatório) |
| `aprovacoes` | aprovações em 2 níveis, vinculadas a orçamento específico |
| `compras` | execução pela TI |
| `pagamentos` | dados de pagamento (boleto/PIX) e comprovantes |
| `documentos` | upload/download com validação de tipo/tamanho |
| `auditoria` | registro append-only de ações críticas |
| `notificacoes` | notificação da TI pós-dupla-aprovação |

## 3. Autenticação e autorização (DEC-008)

- **Auth:** JWT (access token curto + refresh token), senhas com hash Argon2id. Sessão revogável por invalidação de refresh.
- **Autorização:** RBAC com guards declarativos por rota + policy checks por recurso:
  1. Guard de perfil (tabela `perfis`/`permissoes` espelha a permission-matrix);
  2. Guard de posse/setor (solicitante acessa apenas o próprio; gerente apenas o próprio setor; escopos da matriz).
- Toda decisão de permissão tem origem em `/docs/permission-matrix.md`. Conflito → checkpoint, não decisão técnica.

## 4. Máquina de estados (Seção 8 da spec)

Transições validadas no backend (`solicitacoes`), rejeitando tudo fora do fluxo:

```
RASCUNHO → AGUARDANDO_APROVACAO_SETOR → AGUARDANDO_APROVACAO_FINANCEIRA → APROVADO
        ↘ AGUARDANDO_CORRECAO ↗ (devolução pelo gerente; ressubmissão)

APROVADO → AGUARDANDO_TI → COMPRA_EM_ANDAMENTO → AGUARDANDO_FINANCEIRO → PAGO → AGUARDANDO_NF → CONCLUIDO

REPROVADO (terminal) ← reprovação em qualquer nível de aprovação
CANCELADO (terminal) ← regras de cancelamento: PENDENTE_DE_DECISAO (item 1 do checkpoint)
```

- Alteração relevante pós-aprovação → retorno a AGUARDANDO_APROVACAO_SETOR (definição: pendente, item 2).
- Concorrência em aprovação → estratégia: `PENDENTE_DE_DECISAO` (item 6). A implementação usará transação + lock otimista como mecanismo técnico após a decisão de negócio.

## 5. Auditoria (DEC-010)

- Tabela `auditoria` **append-only**: INSERT permitido; UPDATE/DELETE proibidos na camada de aplicação (service dedicado; sem método de alteração).
- Registro: usuário, perfil, ação, entidade, id da entidade, estado anterior/novo, timestamp, dados relevantes (JSON).
- Escrita obrigatória nas ações críticas listadas em CA-09.
- Acesso de leitura: `PENDENTE_DE_DECISAO` (escopo do Administrador).

## 6. Notificações (DEC-011)

- Notificação in-app na tabela `notificacoes` para a TI quando a segunda aprovação ocorrer.
- E-mail/fila externa: fora do MVP; extensível no módulo.

## 7. Uploads (DEC-009)

- Validação server-side de extensão, MIME e tamanho (limite definido na Fase 8).
- Nome randomizado no disco; original preservado nos metadados.
- Download autorizado por permission-matrix (documento de outro setor/setor não visível → 403/404).

## 8. Estratégia de testes

| Nível | Ferramenta | Alvo |
|---|---|---|
| Unitário | Vitest | regras de negócio, máquina de estados, policies |
| Integração | Vitest + Supertest (app Nest) | endpoints com autorização e persistência |
| E2E (piloto) | Vitest + Supertest | cenário completo da Fase 3.5 e 5 cenários da Fase 11 |
| Frontend | Vitest + Testing Library | componentes e fluxos (Fase 5) |
| Segurança | testes negativos de autorização + `npm audit` | Fase 8 |

Metas: ≥90% regras críticas, ≥70% geral (Fase 4); ≥95% totais na homologação (Fase 7).

## 9. Ambiente e deploy

- Dev: `docker compose up -d mysql` + `npm run start:dev` (backend) + `npm run dev` (frontend).
- Variáveis via `.env` (nunca versionadas); `.env.example` como referência.
- Produção: frontend estático via nginx com proxy /api (DEC-030).
- CI (Fase 9): lint + testes + build em cada push.

## 10. Pendências que afetam a arquitetura (resolvidas no checkpoint)

| Item | Afeta |
|---|---|
| Escopo do Administrador | módulos `usuarios`/`auditoria`, rotas de administração |
| Cancelamento (quem/quando) | transições para CANCELADO |
| Alteração relevante | gatilho de retorno ao fluxo de aprovação |
| SLA de aprovação | job/timer sobre estados AGUARDANDO_* |
| Expiração de orçamento | validade na tabela `orcamentos` |
| Concorrência em aprovação | mecanismo de lock sobre `aprovacoes` |
| Identidade do "Financeiro" | tabela `pagamentos` (quem paga) |
| Retenção LGPD | ciclo de vida de `documentos`/`auditoria` |
| Quem anexa a NF | fluxo do `AGUARDANDO_NF` |
