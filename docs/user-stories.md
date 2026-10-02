# User Stories — Sistema de Compras

Derivadas de `/docs/requirements.md` e `/docs/business-rules.md`. Pendências do checkpoint humano foram resolvidas em 2026-09-25 (ver `/docs/decisions.md`, DEC-012 a DEC-025).

## Solicitante

- **US-01** — Como Solicitante, quero criar uma solicitação de compra (rascunho) para registrar minha necessidade.
- **US-02** — Como Solicitante, quero anexar 3 orçamentos com link da loja à minha solicitação, para que ela possa ser aprovada.
- **US-03** — Como Solicitante, quero submeter a solicitação para aprovação do meu gerente.
- **US-04** — Como Solicitante, quero acompanhar o status da minha solicitação (em qual etapa do fluxo ela está).
- **US-05** — Como Solicitante, quero receber a solicitação de volta para correção quando o gerente apontar problemas (`AGUARDANDO_CORRECAO`) e corrigi-la.
- **US-20** — Como Solicitante, quero detalhar minha solicitação com uma lista de itens (produto, quantidade, valor unitário estimado) além da descrição/resumo da compra, para deixar claro o que está sendo comprado (DEC-025).
- **US-21** — Como Solicitante, quero cancelar minha própria solicitação enquanto ela está em RASCUNHO ou AGUARDANDO_CORRECAO, para desistir da compra antes de ela entrar no fluxo de aprovação (DEC-014).

## Gerente (setor)

- **US-06** — Como Gerente, quero visualizar as solicitações pendentes do meu setor para decidir.
- **US-07** — Como Gerente, quero aprovar ou reprovar uma solicitação do meu setor, vinculando a decisão a um orçamento específico.
- **US-08** — Como Gerente, quero enviar a solicitação de volta para correção ao solicitante.

## Gerente Financeira

- **US-09** — Como Gerente Financeira, quero visualizar solicitações aprovadas pelo setor para análise financeira.
- **US-10** — Como Gerente Financeira, quero aprovar ou reprovar financeiramente, vinculando a decisão a um orçamento específico.
- **US-11** — Como Gerente Financeira ou usuário FINANCEIRO, quero receber o boleto ou os dados PIX/QR Code da compra para executar o pagamento (DEC-016).
- **US-12** — Como Gerente Financeira ou usuário FINANCEIRO, quero anexar o comprovante de pagamento à compra (DEC-016).

## FINANCEIRO (DEC-016)

- **US-18** — Como FINANCEIRO, quero visualizar solicitações na fase financeira (a partir de AGUARDANDO_FINANCEIRO) para saber o que precisa ser pago.
- **US-19** — Como FINANCEIRO, quero realizar o pagamento (boleto/PIX) e anexar/registrar o comprovante, sem poder aprovar/reprovar solicitações nem acessar a auditoria.

## TI

- **US-13** — Como TI, quero ser notificada somente de solicitações com as duas aprovações concluídas.
- **US-14** — Como TI, quero visualizar a solicitação aprovada com o orçamento aprovado para executar a compra.
- **US-15** — Como TI, quero registrar a compra em andamento e enviar o boleto ou os dados PIX/QR Code ao Financeiro (sem executar o pagamento).
- **US-22** — Como TI, quero anexar a Nota Fiscal recebida da loja para que a compra possa ser concluída (DEC-023).

## Todos os perfis

- **US-16** — Como usuário autenticado, quero fazer login com minhas credenciais.
- **US-17** — Como usuário, não devo acessar recursos de outro setor nem executar ações fora do meu perfil.

## Administrador

- **US-ADMIN** — Como Administrador, quero gerenciar usuários (criar, editar, vincular perfis e setores) e setores, e ler a auditoria, para manter o sistema organizado (DEC-013) — sem cancelar solicitações, sem aprovar/reprovar, sem visualizar solicitações/compras/pagamentos/documentos e sem alterar permissões de perfis além do vínculo usuário↔perfil.

## Fora do escopo do MVP (piloto — Fase 3.5)

- Funcionalidades do Administrador (escopo agora definido — ver US-ADMIN/DEC-013; implementação permanece fora do piloto);
- cenários avançados e histórico avançado;
- funcionalidades secundárias.
