# Matriz de Permissões — Sistema de Compras

Formato: Perfil × Entidade × Ação (Seção 10 da spec).

Legenda: **S** = permitido · **N** = proibido. Todas as pendências do checkpoint humano (Seção 13) foram resolvidas em 2026-09-25 — ver `/docs/decisions.md` (DEC-012 a DEC-025).

Princípios derivados da spec:

- A interface não é a única camada de segurança (Seção 16) — toda permissão é aplicada no backend.
- Usuário não acessa recurso de outro setor sem autorização (Seção 19).
- Escopo de visibilidade por perfil segue o fluxo (Seção 7).

---

## Solicitante

| Entidade | criar | visualizar | editar | aprovar | reprovar | cancelar | executar | anexar | registrar |
|---|---|---|---|---|---|---|---|---|---|
| Solicitação | S (próprias) | S (próprias) | S (próprias — livre em RASCUNHO/AGUARDANDO_CORRECAO; em AGUARDANDO_APROVACAO_SETOR/AGUARDANDO_APROVACAO_FINANCEIRA/APROVADO/AGUARDANDO_TI qualquer alteração reinicia o fluxo — RN-07/DEC-015; bloqueada (409) a partir de COMPRA_EM_ANDAMENTO e em REPROVADO/CANCELADO/CONCLUIDO — DEC-027) | N | N | S (próprias, somente em RASCUNHO/AGUARDANDO_CORRECAO — DEC-014) | N | — | — |
| Orçamento | S (na própria solicitação) | S (da própria solicitação) | S (na própria solicitação — mesmas regras de RN-07/DEC-015 e DEC-027) | N | N | N | N | S (na própria solicitação) | — |
| Aprovação | N | S (da própria solicitação) | N | N | N | N | N | N | N |
| Compra | N | S (da própria solicitação, status gerais) | N | N | N | N | N | N | N |
| Pagamento | N | S (da própria solicitação — inclui valores e comprovantes — DEC-018) | N | N | N | N | N | N | N |
| Documento | S (orçamentos) | S (da própria solicitação) | S (orçamentos da própria solicitação — mesmas regras de RN-07/DEC-015) | N | N | N | N | S (orçamentos na própria solicitação) | N |
| Auditoria | N | N | N | N | N | N | N | N | N |

## Gerente (setor)

| Entidade | criar | visualizar | editar | aprovar | reprovar | cancelar | executar | anexar | registrar |
|---|---|---|---|---|---|---|---|---|---|
| Solicitação | N | S (do próprio setor) | N | S (do próprio setor, 1º nível) | S (do próprio setor, 1º nível) | N (somente o solicitante cancela — DEC-014) | N | N | — |
| Orçamento | N | S (do próprio setor) | N | N | N | N | N | N | N |
| Aprovação | N | S (do próprio setor) | N | S (1º nível, vinculada a orçamento específico) | — | N | N | N | S (registro da decisão) |
| Compra | N | S (do próprio setor) | N | N | N | N | N | N | N |
| Pagamento | N | S (do próprio setor — inclui valores e comprovantes — DEC-018) | N | N | N | N | N | N | N |
| Documento | N | S (do próprio setor) | N | N | N | N | N | N | N |
| Auditoria | N | N | N | N | N | N | N | N | N |

## Gerente Financeira

| Entidade | criar | visualizar | editar | aprovar | reprovar | cancelar | executar | anexar | registrar |
|---|---|---|---|---|---|---|---|---|---|
| Solicitação | N | S (todas, todos os setores, qualquer estado — leitura global — DEC-017) | N | S (2º nível; e 1º nível em Oficina e TI — DEC-019) | S (2º nível; e 1º nível em Oficina e TI — DEC-019) | N (somente o solicitante cancela — DEC-014) | N | N | — |
| Orçamento | N | S (das solicitações visíveis) | N | N | N | N | N | N | N |
| Aprovação | N | S | N | S (2º nível, vinculada a orçamento específico; 1º nível em Oficina e TI — DEC-019) | — | N | N | N | S (registro da decisão) |
| Compra | N | S | N | N | N | N | N | N | N |
| Pagamento | N | S | N | N | N | N | S (executa o pagamento — DEC-016) | S (comprovante) | S (comprovante de pagamento) |
| Documento | N | S | N | N | N | N | N | S (comprovante) | N |
| Auditoria | N | N | N | N | N | N | N | N | N |

## TI

| Entidade | criar | visualizar | editar | aprovar | reprovar | cancelar | executar | anexar | registrar |
|---|---|---|---|---|---|---|---|---|---|
| Solicitação | N | S (aprovadas — notificadas) | N | N | N | N | N | N | — |
| Orçamento | N | S (das solicitações aprovadas) | N | N | N | N | N | N | N |
| Aprovação | N | S (das solicitações aprovadas) | N | N | N | N | N | N | N |
| Compra | N | S (designadas à TI) | N | N | N | N | S (com o orçamento aprovado) | N | S (dados de pagamento: boleto/PIX → Financeiro) |
| Pagamento | N | S (das compras designadas — inclui valores e comprovantes — DEC-018) | N | N | N | N | N (TI não realiza pagamento) | N | S (boleto/QR/copia-e-cola para envio ao Financeiro) |
| Documento | N | S (das compras designadas) | N | N | N | N | N | S (Nota Fiscal recebida da loja — DEC-023) | N |
| Auditoria | N | N | N | N | N | N | N | N | N |

## FINANCEIRO (DEC-016)

Codificação operacional mínima da resposta do usuário (ajustável): atuação exclusivamente na fase financeira. NÃO aprova/reprova solicitações e NÃO acessa auditoria.

| Entidade | criar | visualizar | editar | aprovar | reprovar | cancelar | executar | anexar | registrar |
|---|---|---|---|---|---|---|---|---|---|
| Solicitação | N | S (a partir de AGUARDANDO_FINANCEIRO — fase financeira) | N | N | N | N | N | N | — |
| Orçamento | N | S (das solicitações visíveis) | N | N | N | N | N | N | N |
| Aprovação | N | S (das solicitações visíveis) | N | N | N | N | N | N | N |
| Compra | N | S (das solicitações visíveis) | N | N | N | N | N | N | N |
| Pagamento | N | S (das solicitações visíveis) | N | N | N | N | S (executa o pagamento — DEC-016) | S (comprovante) | S (comprovante de pagamento) |
| Documento | N | S (das solicitações visíveis) | N | N | N | N | N | S (comprovante) | N |
| Auditoria | N | N (FINANCEIRO não acessa auditoria — DEC-016) | N | N | N | N | N | N | N |

## Administrador (DEC-013)

Escopo: gestão de usuários e setores + leitura da auditoria. Nada mais: sem poderes sobre o fluxo de solicitações (não cancela, não aprova/reprova, não visualiza solicitações/compras/pagamentos/documentos, não altera permissões de perfis além do vínculo usuário↔perfil).

| Entidade | criar | visualizar | editar | aprovar | reprovar | cancelar | executar | anexar | registrar |
|---|---|---|---|---|---|---|---|---|---|
| Solicitação | N | N | N | N | N | N | N | N | N |
| Orçamento | N | N | N | N | N | N | N | N | N |
| Aprovação | N | N | N | N | N | N | N | N | N |
| Compra | N | N | N | N | N | N | N | N | N |
| Pagamento | N | N | N | N | N | N | N | N | N |
| Documento | N | N | N | N | N | N | N | N | N |
| Auditoria | N | S (leitura — DEC-013) | N | N | N | N | N | N | N |
| Usuário | S (criar) | S | S (editar/vincular perfis e setores) | N | N | N | N | N | N |
| Setor | S (criar) | S | S (editar) | N | N | N | N | N | N |

---

## Pendências resolvidas no checkpoint de 2026-09-25

Todas as pendências desta matriz foram resolvidas pelo usuário no checkpoint humano (Seção 13, 2026-09-25):

1. **P¹ — Cancelamento:** somente o solicitante cancela, apenas as próprias solicitações, apenas em RASCUNHO e AGUARDANDO_CORRECAO (DEC-014). A ação "cancelar" aplicada a outras entidades permanece N (sem autorização na decisão).
2. **P² — Visibilidade financeira:** a Gerente Financeira visualiza todas as solicitações de todos os setores em qualquer estado (DEC-017); todos os envolvidos veem valores e comprovantes, sem ocultação financeira por perfil (DEC-018).
3. **P³ — Auditoria:** leitura exclusivamente pelo Administrador (DEC-013); demais perfis N.
4. **P⁴ — Pagamento:** executado pela Gerente Financeira ou pelo perfil FINANCEIRO (DEC-016).
5. **P⁵ — Nota Fiscal:** anexada pela TI, recebida da loja (DEC-023).
