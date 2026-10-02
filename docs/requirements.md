# Requisitos — Sistema de Compras

Fonte: especificação do orquestrador v3.0 (Seções 6–8) e decisões do checkpoint humano (Seção 13, 2026-09-25 — ver `/docs/decisions.md`, DEC-012 a DEC-025).

## 1. Objetivo

Sistema de controle de solicitações de compra com aprovação em dois níveis (gerente do setor e Gerente Financeira), execução pela TI, pagamento pelo Financeiro e rastreabilidade completa via auditoria.

## 2. Atores (perfis)

| Perfil | Papel no fluxo |
|---|---|
| Solicitante | cria solicitações e anexa orçamentos; cancela as próprias solicitações em RASCUNHO/AGUARDANDO_CORRECAO (DEC-014) |
| Gerente | aprova/reprova solicitações do seu setor (1º nível) |
| Gerente Financeira | aprova/reprova financeiramente (2º nível); acumula o 1º nível em Oficina e TI (DEC-019); realiza pagamento (DEC-016); leitura global de todas as solicitações em qualquer estado (DEC-017) |
| TI | executa a compra com o orçamento aprovado; anexa a NF recebida da loja (DEC-023); não realiza pagamento |
| FINANCEIRO | executa a fase financeira (DEC-016): visualiza solicitações a partir de AGUARDANDO_FINANCEIRO, realiza pagamento e anexa comprovante; não aprova/reprova e não acessa auditoria |
| Administrador | gerencia usuários (criar/editar/vincular perfis e setores) e setores, e lê a auditoria (DEC-013); sem poderes sobre o fluxo de solicitações |

## 3. Setores e hierarquia de aprovação

| Setor | Gerente do setor | Aprovação financeira |
|---|---|---|
| Oficina | Gerente Financeira (acumula o 1º nível — DEC-019) | Gerente Financeira |
| TI | Gerente Financeira (acumula o 1º nível — DEC-019) | Gerente Financeira |
| MKT | Gerente de MKT | Gerente Financeira |
| Comercial | Gerente Comercial | Gerente Financeira |

## 4. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-01 | Solicitante cria solicitação de compra (rascunho → submissão) |
| RF-02 | Solicitação deve possuir exatamente 3 orçamentos antes da aprovação |
| RF-03 | Cada orçamento deve possuir link da loja |
| RF-04 | A loja deve fornecer Nota Fiscal para o CNPJ da empresa |
| RF-05 | Gerente responsável pelo setor aprova/reprova (1º nível) |
| RF-06 | Gerente Financeira aprova/reprova (2º nível) |
| RF-07 | TI é notificada somente após as duas aprovações |
| RF-08 | TI realiza a compra utilizando o orçamento aprovado |
| RF-09 | Pagamento via boleto ou PIX; TI não realiza o pagamento |
| RF-10 | Boleto é enviado ao Financeiro; PIX (dados/QR Code/copia e cola) é enviado ao Financeiro |
| RF-11 | Gerente Financeira ou perfil FINANCEIRO realiza o pagamento e registra/anexa comprovante (DEC-016) |
| RF-12 | NF deve ser anexada pela TI, que a recebe da loja (DEC-023) |
| RF-13 | Compra concluída somente com documentação obrigatória presente |
| RF-14 | Ações críticas registradas em auditoria |
| RF-15 | Aprovação vinculada a um orçamento específico |
| RF-16 | Alteração relevante (= qualquer alteração — DEC-015) após aprovação exige nova aprovação |
| RF-17 | Controle de acesso por perfil e por setor |
| RF-18 | Upload de documentos (orçamentos, comprovantes, NF) |
| RF-19 | Solicitação possui lista de itens (produto, quantidade, valor unitário estimado) e campo de descrição textual (resumo/objetivo da compra) (DEC-025) |
| RF-20 | Somente o solicitante cancela, apenas as próprias solicitações em RASCUNHO e AGUARDANDO_CORRECAO; CANCELADO é alcançável somente a partir desses dois estados (DEC-014) |

## 5. Requisitos não-funcionais

| ID | Requisito |
|---|---|
| RNF-01 | Segurança: autorização validada no backend; interface não é a única camada de segurança |
| RNF-02 | Auditoria: ações críticas rastreáveis (quem, quando, o quê) |
| RNF-03 | LGPD: auditoria retida por tempo indeterminado; NF e comprovantes retidos por 5 anos (prazo usual de guarda fiscal — a confirmar com a contabilidade da empresa); sem expurgo automático no MVP (DEC-024) |
| RNF-04 | Upload valida tipo/extensão/tamanho |
| RNF-05 | Secrets fora do código-fonte |
| RNF-06 | Deploy reproduzível via Docker |
| RNF-07 | Testes: ≥90% das regras críticas; ≥95% totais passando na homologação |
| RNF-08 | SLA de aprovação: lembrete in-app ao aprovador pendente após N dias sem decisão (N configurável, padrão 3 dias); sem timeout automático nem transição automática de estado (DEC-020) |

## 6. Estados do processo (Seção 8 da spec)

RASCUNHO → AGUARDANDO_APROVACAO_SETOR → AGUARDANDO_APROVACAO_FINANCEIRA → APROVADO → AGUARDANDO_TI → COMPRA_EM_ANDAMENTO → AGUARDANDO_FINANCEIRO → PAGO → AGUARDANDO_NF → CONCLUIDO

Transversais: REPROVADO · CANCELADO · AGUARDANDO_CORRECAO

## 7. Pendências do checkpoint (Seção 13) — resolvidas em 2026-09-25

| # | Pendência original | Resolução | Registro |
|---|---|---|---|
| 1 | Escopo do perfil **Administrador** | Gestão de usuários (criar/editar/vincular perfis e setores) e setores + leitura da auditoria; nada mais | DEC-013 |
| 2 | Definição objetiva de **alteração relevante** | Qualquer alteração em qualquer campo (solicitação, itens, orçamentos) em estado não-terminal retorna o fluxo para AGUARDANDO_APROVACAO_SETOR com ciclo incrementado | DEC-015 |
| 3 | **SLA/timeout de aprovação** | Lembrete in-app após N dias sem decisão (N configurável, padrão 3); sem timeout automático nem transição de estado | DEC-020 |
| 4 | **Expiração/validade de orçamento** | Campo de validade opcional; sem bloqueio automático no MVP; TI confere manualmente antes de comprar | DEC-021 |
| 5 | **Concorrência em aprovação** | Garantia estrutural: uma decisão por nível por ciclo (unique no banco); segunda ação simultânea/duplicada → erro 409 | DEC-022 |
| 6 | **Retenção de documentos e auditoria** (LGPD) | Auditoria por tempo indeterminado; NF e comprovantes por 5 anos (a confirmar com a contabilidade); sem expurgo automático no MVP | DEC-024 |
| 7 | **Quem executa o pagamento** | Gerente Financeira ou usuário do perfil FINANCEIRO (fase financeira: pagamento + comprovante) | DEC-016 |
| 8 | **Gerentes dos setores Oficina e TI** | A Gerente Financeira acumula o 1º nível nesses setores (decisões distintas por nível, em sequência) | DEC-019 |
