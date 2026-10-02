# Regras de Negócio — Sistema de Compras

Fonte: especificação do orquestrador v3.0 (Seções 6–8). Hierarquia de source of truth: decisão do usuário (checkpoint 2026-09-25 — ver `/docs/decisions.md`) > este arquivo.

## RN-01 — Orçamentos

- Uma solicitação deve possuir **3 orçamentos** para ser aprovável.
- Cada orçamento deve possuir **link da loja**.
- A loja deve fornecer **Nota Fiscal para o CNPJ da empresa**.
- O orçamento pode possuir **campo de validade opcional**; sem bloqueio automático por expiração no MVP — a TI confere manualmente antes de comprar (DEC-021).

## RN-02 — Aprovação em dois níveis

1. O **gerente responsável pelo setor** do solicitante aprova (1º nível).
2. A **Gerente Financeira** aprova (2º nível).
3. Somente após **as duas aprovações** a TI é notificada.

Hierarquia por setor:

| Setor | Aprovação de setor (1º nível) | Aprovação financeira (2º nível) |
|---|---|---|
| Oficina | Gerente Financeira (acumula o 1º nível — DEC-019) | Gerente Financeira |
| TI | Gerente Financeira (acumula o 1º nível — DEC-019) | Gerente Financeira |
| MKT | Gerente de MKT | Gerente Financeira |
| Comercial | Gerente Comercial | Gerente Financeira |

- Em Oficina e TI, a Gerente Financeira acumula os dois níveis: as duas aprovações ocorrem **em sequência** e são registradas como **decisões distintas por nível** (uma decisão por nível por ciclo — RN-08/DEC-022). A GF **não** acumula o 1º nível em MKT e Comercial (gerentes próprios) (DEC-019).
- SLA de aprovação (DEC-020): sem timeout automático; após N dias sem decisão (N configurável, padrão 3 dias), o aprovador pendente recebe **lembrete in-app**. Nenhuma transição automática de estado.

## RN-03 — Compra e pagamento

- A **TI realiza a compra** utilizando o orçamento aprovado.
- Pagamento ocorre via **boleto ou PIX**.
- **TI não realiza o pagamento.**
- Boleto é **enviado ao Financeiro**.
- Para PIX, os dados/QR Code/copia e cola são **enviados ao Financeiro**.
- Quem paga (DEC-016): a **Gerente Financeira** ou um usuário do perfil **FINANCEIRO** (codificação operacional mínima da resposta do usuário — ajustável). O pagador realiza o pagamento e registra/anexa o comprovante.
- O perfil FINANCEIRO atua exclusivamente na fase financeira: visualiza solicitações a partir de AGUARDANDO_FINANCEIRO, executa o pagamento e anexa o comprovante. FINANCEIRO **não** aprova/reprova solicitações e **não** acessa auditoria (DEC-016).

## RN-04 — Conclusão

- A NF deve ser anexada.
- A compra somente pode ser considerada **CONCLUIDO** quando a documentação obrigatória estiver presente (comprovante de pagamento + NF).

## RN-05 — Auditoria

- Ações críticas devem ser registradas em auditoria (quem, quando, ação, entidade afetada).
- Acesso de leitura à auditoria: exclusivamente o **Administrador** (DEC-013); demais perfis não acessam (ver `/docs/permission-matrix.md`).
- Retenção (DEC-024): auditoria retida por **tempo indeterminado**; NF e comprovantes retidos por **5 anos** (prazo usual de guarda fiscal — a confirmar com a contabilidade da empresa); sem expurgo automático no MVP.

## RN-06 — Vínculo de aprovação

- A aprovação deve estar **vinculada a um orçamento específico** (o aprovador escolhe/ampara sua decisão em um orçamento concreto).

## RN-07 — Alteração relevante

- Definição aprovada (DEC-015): alteração relevante = **QUALQUER alteração** (interpretação conservadora).
- Codificação operacional:
  - (a) A solicitação é editável livremente em **RASCUNHO** e **AGUARDANDO_CORRECAO**.
  - (b) **Codificação operacional da decisão "qualquer alteração" (delimitada pela DEC-027):** nos estados **AGUARDANDO_APROVACAO_SETOR, AGUARDANDO_APROVACAO_FINANCEIRA, APROVADO e AGUARDANDO_TI**, **qualquer alteração em qualquer campo da solicitação, seus itens ou orçamentos** retorna o fluxo para **AGUARDANDO_APROVACAO_SETOR** com novo ciclo de aprovação (**cicloAprovacao + 1**). A partir de **COMPRA_EM_ANDAMENTO** (compra iniciada pela TI), a edição é **bloqueada (409)** — mudança no que foi comprado exige **nova solicitação** (DEC-027).
  - (c) **REPROVADO**, **CANCELADO**, **CONCLUIDO** e os estados pós-compra (**COMPRA_EM_ANDAMENTO, AGUARDANDO_FINANCEIRO, PAGO, AGUARDANDO_NF**) não são editáveis.

## RN-08 — Regras operacionais (itens 3–6 do checkpoint — resolvidos em 2026-09-25)

| Regra | Definição | Registro |
|---|---|---|
| SLA/timeout de aprovação | Lembrete in-app ao aprovador pendente após N dias sem decisão (N configurável, padrão 3 dias); sem timeout automático e sem transição automática de estado | DEC-020 |
| Expiração/validade de orçamento | Campo de validade opcional; sem bloqueio automático no MVP; a TI confere manualmente antes de comprar | DEC-021 |
| Concorrência em aprovação | Garantia estrutural: uma única decisão por nível por ciclo de aprovação (constraint unique no banco, já presente no schema); segunda ação simultânea/duplicada recebe erro 409 e não é registrada como decisão | DEC-022 |
| Retenção de documentos/auditoria (LGPD) | Auditoria por tempo indeterminado; NF e comprovantes por 5 anos (a confirmar com a contabilidade da empresa); sem expurgo automático no MVP | DEC-024 |

## RN-09 — Estados e transições

Estados permitidos (Seção 8 da spec): RASCUNHO, AGUARDANDO_APROVACAO_SETOR, AGUARDANDO_APROVACAO_FINANCEIRA, APROVADO, AGUARDANDO_TI, COMPRA_EM_ANDAMENTO, AGUARDANDO_FINANCEIRO, PAGO, AGUARDANDO_NF, CONCLUIDO, REPROVADO, CANCELADO, AGUARDANDO_CORRECAO.

- Não criar novos estados para resolver problemas de implementação.
- Transições permitidas: ver `/docs/acceptance-criteria.md`.
- Cancelamento (DEC-014): **somente o solicitante**, apenas as **próprias** solicitações, apenas em **RASCUNHO** e **AGUARDANDO_CORRECAO** (pré-fluxo). Após entrar no fluxo de aprovação, **ninguém cancela** (usa-se reprovação/devolução). CANCELADO é alcançável somente a partir desses dois estados.

## RN-10 — Itens estruturados (DEC-025)

- A solicitação carrega uma **lista de itens**: produto, quantidade, valor unitário estimado.
- Mantém também um campo de **descrição textual** (resumo/objetivo da compra). Codificação: descrição = resumo/objetivo; itens = detalhamento estruturado.

## RN-11 — Nota Fiscal (DEC-023)

- A **TI anexa a NF** recebida da loja.
- O estado AGUARDANDO_NF é de **responsabilidade da TI**.

## RN-12 — Visibilidade financeira (DEC-017, DEC-018)

- **Gerente Financeira** (DEC-017): visualiza **TODAS as solicitações de todos os setores em qualquer estado** (leitura global).
- **Detalhes financeiros** (DEC-018): todos os envolvidos (Solicitante, Gerente do setor, TI e pagadores) veem **valores e comprovantes** das solicitações às quais já têm acesso pela matriz (próprias / do próprio setor / designadas à TI / fase financeira). **Sem ocultação financeira por perfil.**
