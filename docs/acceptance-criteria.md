# Critérios de Aceite — Sistema de Compras

Todos os critérios são testáveis. Validação (Fase 7/QA) é feita contra este documento, nunca contra a implementação existente. Pendências do checkpoint humano foram resolvidas em 2026-09-25 (ver `/docs/decisions.md`, DEC-012 a DEC-025).

## CA-01 — Criação e submissão (US-01, US-02, US-03)

1. Solicitante autenticado cria solicitação com estado inicial RASCUNHO.
2. Solicitação sem 3 orçamentos **não** pode ser submetida para aprovação (RN-01).
3. Orçamento sem link da loja é rejeitado (RN-01).
4. Ao submeter, o estado muda para AGUARDANDO_APROVACAO_SETOR.
5. Criação/submissão são registradas em auditoria (RN-05).

## CA-02 — Aprovação de setor (US-06, US-07)

1. Gerente do setor do solicitante visualiza solicitações do próprio setor em AGUARDANDO_APROVACAO_SETOR.
2. Gerente aprova vinculando a aprovação a um orçamento específico (RN-06).
3. Ao aprovar, estado muda para AGUARDANDO_APROVACAO_FINANCEIRA.
4. Ao reprovar, estado muda para REPROVADO (terminal).
5. Aprovação/reprovação registrada em auditoria com autor, data e orçamento vinculado.
6. Gerente de outro setor não consegue aprovar (403/404 — política anti-enumeração, ver CA-10.3).

## CA-03 — Aprovação financeira (US-09, US-10)

1. Gerente Financeira visualiza solicitações em AGUARDANDO_APROVACAO_FINANCEIRA.
2. Aprovação vincula-se a um orçamento específico (RN-06).
3. Ao aprovar, estado muda para APROVADO e a TI é notificada (RN-02).
4. Ao reprovar, estado muda para REPROVADO.
5. TI **não** é notificada se apenas um dos dois níveis aprovou.
6. Demais perfis recebem 403 ao tentar aprovar neste nível.

## CA-04 — Compra pela TI (US-13, US-14)

1. TI visualiza apenas solicitações APROVADO/AGUARDANDO_TI (as duas aprovações concluídas).
2. TI inicia a compra: estado COMPRA_EM_ANDAMENTO.
3. A compra utiliza o orçamento aprovado (valor e loja vinculados) (RN-03).
4. TI **não** consegue executar ação de pagamento (proibido — RN-03).

## CA-05 — Envio ao Financeiro e pagamento (US-11, US-12, US-15)

1. TI registra dados de pagamento: boleto OU PIX (QR Code/copia e cola) (RN-03).
2. Ao concluir o registro, estado muda para AGUARDANDO_FINANCEIRO.
3. O pagamento é executado pela Gerente Financeira ou por usuário do perfil FINANCEIRO (DEC-016), que anexa/registra o comprovante.
4. Estado muda para PAGO.
5. Comprovante fica vinculado à compra em auditoria/documentos.
6. FINANCEIRO visualiza a solicitação somente a partir de AGUARDANDO_FINANCEIRO; tentativa de visualização em estado anterior → 403/404 (DEC-016).

## CA-06 — Documentação e conclusão (RF-12, RF-13)

1. Sem comprovante OU sem NF, a compra não pode passar para CONCLUIDO (RN-04).
2. Com comprovante e NF anexados, estado muda para CONCLUIDO.
3. A NF é anexada pela TI, que a recebe da loja (DEC-023, RN-11); demais perfis não anexam NF (403).

## CA-07 — Correção (US-05, US-08)

1. Gerente pode devolver solicitação para correção: estado AGUARDANDO_CORRECAO.
2. Solicitante edita e resubmete: estado volta a AGUARDANDO_APROVACAO_SETOR.
3. Ciclo de correção registrado em auditoria.

## CA-08 — Alteração relevante (RF-16, DEC-015)

1. Em RASCUNHO e AGUARDANDO_CORRECAO, o solicitante edita livremente qualquer campo da solicitação (dados, itens, orçamentos).
2. Codificação operacional da decisão "qualquer alteração": em qualquer outro estado não-terminal (AGUARDANDO_APROVACAO_SETOR, AGUARDANDO_APROVACAO_FINANCEIRA, APROVADO, AGUARDANDO_TI, COMPRA_EM_ANDAMENTO, AGUARDANDO_FINANCEIRO, PAGO, AGUARDANDO_NF), qualquer alteração em qualquer campo da solicitação, seus itens ou orçamentos retorna o fluxo para AGUARDANDO_APROVACAO_SETOR com cicloAprovacao + 1.
3. Em REPROVADO, CANCELADO e CONCLUIDO, qualquer edição é rejeitada.

## CA-09 — Auditoria (RF-14)

1. Toda ação crítica (criar, submeter, aprovar, reprovar, corrigir, comprar, pagar, concluir, cancelar) gera registro com autor, timestamp, ação e entidade.
2. Registros de auditoria são imutáveis (append-only).
3. Acesso de leitura à auditoria: somente o Administrador (DEC-013); Solicitante, Gerente, Gerente Financeira, TI e FINANCEIRO recebem 403.

## CA-10 — Segurança e isolamento (US-17, RNF-01)

1. Endpoint crítico sem autenticação → 401.
2. Perfil sem permissão (permission-matrix) → 403.
3. Solicitante não acessa solicitação de outro setor/usuário → 403/404.
4. Upload aceita apenas tipos permitidos com limite de tamanho (RNF-04).
5. Nenhum secret no código-fonte (RNF-05).
6. Administrador tentando qualquer ação de fluxo (aprovar, reprovar, cancelar, editar) ou visualizar solicitações, compras, pagamentos ou documentos → 403/404 (DEC-013).
7. FINANCEIRO tentando aprovar/reprovar solicitações ou acessar auditoria → 403 (DEC-016).

## CA-11 — Estados inválidos

1. Transições fora do fluxo definido são rejeitadas (ex.: RASCUNHO → APROVADO; PAGO → AGUARDANDO_APROVACAO_SETOR).
2. Dupla aprovação do mesmo nível na mesma solicitação no mesmo ciclo é rejeitada: garantia estrutural de uma decisão por nível por ciclo (DEC-022); a segunda ação simultânea/duplicada recebe erro 409 e não é registrada como decisão.

## CA-12 — Cancelamento (DEC-014)

1. Solicitante cancela a própria solicitação em RASCUNHO: estado → CANCELADO.
2. Solicitante cancela a própria solicitação em AGUARDANDO_CORRECAO: estado → CANCELADO.
3. Tentativa de cancelamento em qualquer outro estado (AGUARDANDO_APROVACAO_SETOR, AGUARDANDO_APROVACAO_FINANCEIRA, APROVADO, AGUARDANDO_TI, COMPRA_EM_ANDAMENTO, AGUARDANDO_FINANCEIRO, PAGO, AGUARDANDO_NF, REPROVADO, CONCLUIDO) é rejeitada.
4. Gerente, Gerente Financeira, TI, FINANCEIRO ou Administrador tentando cancelar qualquer solicitação → 403.
5. Solicitante tentando cancelar solicitação de outro usuário → 403/404.
6. Cancelamento registrado em auditoria.

## CA-13 — Alteração pós-aprovação reinicia o fluxo (DEC-015, delimitada pela DEC-027)

1. Solicitante altera qualquer campo (dados da solicitação, itens ou orçamentos) de uma solicitação em AGUARDANDO_APROVACAO_SETOR, AGUARDANDO_APROVACAO_FINANCEIRA, APROVADO ou AGUARDANDO_TI → estado retorna a AGUARDANDO_APROVACAO_SETOR e cicloAprovacao é incrementado (+1).
2. O novo ciclo exige nova decisão de 1º nível (e, em seguida, de 2º nível), mesmo que o ciclo anterior tivesse sido aprovado pelos dois níveis.
3. A alteração e o novo ciclo ficam registrados em auditoria.
4. (DEC-027) A partir de COMPRA_EM_ANDAMENTO a edição é rejeitada (409) — solicitação e orçamentos não podem mais ser alterados; mudança no que foi comprado exige nova solicitação.

## Cenários de homologação obrigatórios (Fase 11)

| Cenário | Critérios base |
|---|---|
| 1. Compra aprovada completa | CA-01 a CA-06 |
| 2. Solicitação reprovada | CA-02.4 |
| 3. Correção e reprocessamento | CA-07 |
| 4. Tentativa de acesso indevido | CA-10 |
| 5. Alteração relevante pós-aprovação | CA-08, CA-13 |
| 6. Cancelamento pré-fluxo | CA-12 |
