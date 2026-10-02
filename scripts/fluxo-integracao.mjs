// TASK-063 (Fase 6 — Integração): fluxo completo do piloto (spec §17) na stack real.
// Percurso: proxy do frontend (Vite :5173) → backend (NestJS :3000) → MariaDB (:3306).
//
// Uso: node scripts/fluxo-integracao.mjs [URL_BASE]
//   URL_BASE padrão: http://localhost:5173 (mesmo caminho que o navegador da UI usa).
//
// Cenário (spec §14, pilot cross-profile; DEC-013/016/018/023 aplicáveis):
//   ana (SOLICITANTE, MKT) cria solicitação + 3 orçamentos e submete;
//   bruno (GERENTE, MKT) aprova 1º nível vinculado ao orçamento 1;
//   carla (GERENTE_FINANCEIRA) aprova 2º nível vinculado ao orçamento 2;
//   davi (TI) executa a compra (orçamento da GF) e envia boleto ao Financeiro;
//   elisa (FINANCEIRO) paga e anexa comprovante;
//   davi anexa a NF e a compra é concluída.
// Inclui sonda negativa de permissão (FINANCEIRO não aprova — DEC-016 → 403).
// Ao final imprime o ID da solicitação para a validação de persistência no banco.

const BASE = process.argv[2] ?? 'http://localhost:5173'
const API = `${BASE}/api`
const SENHA = 'SenhaDev123!'

const USUARIOS = {
  ana: 'ana.souza@compras.local', // SOLICITANTE / MKT
  bruno: 'bruno.lima@compras.local', // GERENTE / MKT
  carla: 'carla.mendes@compras.local', // GERENTE_FINANCEIRA
  davi: 'davi.costa@compras.local', // TI
  elisa: 'elisa.rae@compras.local', // FINANCEIRO
}

const DESCRICAO =
  '[Fase 6/Integração TASK-063] Impressora multifuncional laser para o setor de MKT — fluxo do piloto na stack real'
const PDF_COMPROVANTE = Buffer.from('%PDF-1.4\ncomprovante fase 6\n%%EOF')
const PDF_NF = Buffer.from('%PDF-1.4\nnota fiscal fase 6\n%%EOF')
const LINHA_DIGITAVEL =
  '34191.09008 63541.820047 91020.150008 7 1234567890123456'
const VALOR_PAGO = '379.50'

let passosOk = 0
let passosTotal = 0
const falhas = []

function passo(descricao, condicao, detalhe = '') {
  passosTotal += 1
  const ok = Boolean(condicao)
  if (ok) {
    passosOk += 1
    console.log(`  ok  ${descricao}`)
  } else {
    falhas.push(`${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
    console.log(`FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

async function entrar(email) {
  const resposta = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha: SENHA }),
  })
  if (!resposta.ok) {
    throw new Error(`login falhou para ${email}: HTTP ${resposta.status}`)
  }
  const { accessToken } = await resposta.json()
  return accessToken
}

async function chamar(token, caminho, opcoes = {}) {
  const cabecalhos = { ...(opcoes.cabecalhos ?? {}) }
  if (token) cabecalhos.Authorization = `Bearer ${token}`
  if (opcoes.corpo !== undefined && !(opcoes.corpo instanceof FormData)) {
    cabecalhos['Content-Type'] = 'application/json'
  }
  const resposta = await fetch(`${API}${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    body:
      opcoes.corpo instanceof FormData
        ? opcoes.corpo
        : opcoes.corpo !== undefined
          ? JSON.stringify(opcoes.corpo)
          : undefined,
  })
  let corpo = null
  try {
    corpo = await resposta.json()
  } catch {
    corpo = null
  }
  return { status: resposta.status, corpo }
}

function multipart(campos) {
  const formulario = new FormData()
  for (const [nome, valor] of Object.entries(campos)) {
    if (valor.arquivo !== undefined) {
      formulario.append(nome, new Blob([valor.arquivo], { type: 'application/pdf' }), valor.nome)
    } else {
      formulario.append(nome, valor)
    }
  }
  return formulario
}

async function detalhe(token, id) {
  const { status, corpo } = await chamar(token, `/solicitacoes/${id}`)
  if (status !== 200) throw new Error(`GET detalhe falhou: HTTP ${status}`)
  return corpo
}

async function main() {
  console.log(`STACK: ${BASE} → /api (proxy) → backend :3000 → MariaDB :3306`)

  // ===== PASSO 1 — ana (SOLICITANTE): cria a solicitação (RASCUNHO)
  const tokenAna = await entrar(USUARIOS.ana)
  const criacao = await chamar(tokenAna, '/solicitacoes', {
    metodo: 'POST',
    corpo: {
      descricao: DESCRICAO,
      itens: [
        { produto: 'Impressora multifuncional laser', quantidade: 1, valorUnitarioEstimado: 450 },
      ],
    },
  })
  passo('ana cria solicitação → 201 RASCUNHO', criacao.status === 201 && criacao.corpo?.status === 'RASCUNHO', `HTTP ${criacao.status}`)
  const id = criacao.corpo?.id

  // ===== PASSO 2 — ana: adiciona 3 orçamentos com link da loja (RN-01/RF-03)
  const dadosOrcamentos = [
    { linkLoja: 'https://loja-a.example.com/impressora', valor: 449.0 },
    { linkLoja: 'https://loja-b.example.com/impressora', valor: 379.5 },
    { linkLoja: 'https://loja-c.example.com/impressora', valor: 429.0 },
  ]
  const idsOrcamentos = []
  for (const [indice, orcamento] of dadosOrcamentos.entries()) {
    const resposta = await chamar(tokenAna, `/solicitacoes/${id}/orcamentos`, {
      metodo: 'POST',
      corpo: { linkLoja: orcamento.linkLoja, cnpjLoja: '12345678000199', valor: orcamento.valor },
    })
    passo(`ana adiciona orçamento ${indice + 1}/3 → 201`, resposta.status === 201, `HTTP ${resposta.status}`)
    idsOrcamentos.push(resposta.corpo?.id)
  }

  // ===== PASSO 3 — ana: submete → AGUARDANDO_APROVACAO_SETOR (CA-01.4)
  const submissao = await chamar(tokenAna, `/solicitacoes/${id}/submeter`, { metodo: 'POST' })
  passo(
    'ana submete → AGUARDANDO_APROVACAO_SETOR',
    submissao.status === 200 && (submissao.corpo?.status ?? (await detalhe(tokenAna, id)).status) === 'AGUARDANDO_APROVACAO_SETOR',
    `HTTP ${submissao.status}`,
  )

  // ===== PASSO 4 — bruno (GERENTE/MKT): vê a fila do setor e aprova 1º nível no orçamento 1 (RN-06/RF-15)
  const tokenBruno = await entrar(USUARIOS.bruno)
  const filaSetor = await chamar(tokenBruno, '/solicitacoes?status=AGUARDANDO_APROVACAO_SETOR')
  passo(
    'bruno vê a solicitação na fila do seu setor',
    filaSetor.status === 200 && Array.isArray(filaSetor.corpo) && filaSetor.corpo.some((item) => item.id === id),
    `HTTP ${filaSetor.status}`,
  )
  const decisaoSetor = await chamar(tokenBruno, `/solicitacoes/${id}/decisao`, {
    metodo: 'POST',
    corpo: { orcamentoId: idsOrcamentos[0], decisao: 'APROVADO' },
  })
  const posSetor = await detalhe(tokenAna, id)
  passo(
    'bruno aprova 1º nível (orçamento 1) → AGUARDANDO_APROVACAO_FINANCEIRA',
    decisaoSetor.status === 200 && posSetor.status === 'AGUARDANDO_APROVACAO_FINANCEIRA',
    `HTTP ${decisaoSetor.status} / status ${posSetor.status}`,
  )

  // ===== PASSO 5 — carla (GERENTE_FINANCEIRA): aprova 2º nível no orçamento 2 (RF-15/DEC-018)
  const tokenCarla = await entrar(USUARIOS.carla)
  const decisaoFinanceira = await chamar(tokenCarla, `/solicitacoes/${id}/decisao`, {
    metodo: 'POST',
    corpo: { orcamentoId: idsOrcamentos[1], decisao: 'APROVADO' },
  })
  const posFinanceira = await detalhe(tokenAna, id)
  passo(
    'carla aprova 2º nível (orçamento 2) → APROVADO',
    decisaoFinanceira.status === 200 && posFinanceira.status === 'APROVADO',
    `HTTP ${decisaoFinanceira.status} / status ${posFinanceira.status}`,
  )

  // ===== PASSO 6 — davi (TI): notificado somente agora (RN-02/CA-03.5) e executa a compra (RN-03/CA-04)
  const tokenDavi = await entrar(USUARIOS.davi)
  const notificacoes = await chamar(tokenDavi, '/notificacoes')
  passo(
    'davi (TI) tem ≥1 notificação vinculada à solicitação',
    notificacoes.status === 200 && Array.isArray(notificacoes.corpo) && notificacoes.corpo.some((item) => item.solicitacaoId === id),
    `HTTP ${notificacoes.status}`,
  )
  const compra = await chamar(tokenDavi, `/solicitacoes/${id}/compra`, { metodo: 'POST' })
  const posCompra = await detalhe(tokenAna, id)
  passo(
    'davi executa a compra → COMPRA_EM_ANDAMENTO com o orçamento da GF',
    compra.status === 200 && posCompra.status === 'COMPRA_EM_ANDAMENTO' && posCompra.compra?.orcamentoId === idsOrcamentos[1],
    `HTTP ${compra.status} / orcamento ${posCompra.compra?.orcamentoId}`,
  )

  // ===== PASSO 7 — davi: envia o boleto ao Financeiro (RN-04/CA-05.2)
  const dadosPagamento = await chamar(tokenDavi, `/solicitacoes/${id}/pagamento-dados`, {
    metodo: 'POST',
    corpo: { forma: 'BOLETO', dados: LINHA_DIGITAVEL },
  })
  const posDados = await detalhe(tokenAna, id)
  passo(
    'davi envia boleto → AGUARDANDO_FINANCEIRO com dados visíveis',
    dadosPagamento.status === 200 && posDados.status === 'AGUARDANDO_FINANCEIRO' && posDados.pagamento?.dados === LINHA_DIGITAVEL,
    `HTTP ${dadosPagamento.status} / status ${posDados.status}`,
  )

  // ===== PASSO 8 — elisa (FINANCEIRO): NÃO pode aprovar (DEC-016) — sonda negativa
  const tokenElisa = await entrar(USUARIOS.elisa)
  const sondaAprovacao = await chamar(tokenElisa, `/solicitacoes/${id}/decisao`, {
    metodo: 'POST',
    corpo: { orcamentoId: idsOrcamentos[2], decisao: 'APROVADO' },
  })
  passo('elisa (FINANCEIRO) tentando aprovar → 403 negado', sondaAprovacao.status === 403, `HTTP ${sondaAprovacao.status}`)

  // ===== PASSO 9 — elisa: paga e anexa comprovante (RN-05/CA-05.4, DEC-016)
  const posDados2 = await detalhe(tokenElisa, id)
  const pagamentoId = posDados2.pagamento?.id
  const pagamento = await chamar(tokenElisa, `/pagamentos/${pagamentoId}/pagar`, {
    metodo: 'POST',
    corpo: multipart({
      valorPago: VALOR_PAGO,
      arquivo: { arquivo: PDF_COMPROVANTE, nome: 'comprovante-fase6.pdf' },
    }),
  })
  const posPagamento = await detalhe(tokenAna, id)
  passo(
    'elisa paga com comprovante → PAGO',
    pagamento.status === 200 && posPagamento.status === 'PAGO' && String(posPagamento.pagamento?.valorPago ?? '').startsWith('379.5') && posPagamento.pagamento?.pagoEm != null,
    `HTTP ${pagamento.status} / status ${posPagamento.status}`,
  )

  // ===== PASSO 10 — davi: anexa a NF recebida da loja (DEC-023/CA-06)
  // Contrato real: POST /nf responde 200 (documentos.controller @HttpCode(OK)); o e2e
  // backend (fluxo-completo.e2e-spec) trava esse contrato.
  const nf = await chamar(tokenDavi, `/solicitacoes/${id}/nf`, {
    metodo: 'POST',
    corpo: multipart({ arquivo: { arquivo: PDF_NF, nome: 'nota-fiscal-fase6.pdf' } }),
  })
  const posNf = await detalhe(tokenAna, id)
  passo('davi anexa a NF → 200', nf.status === 200, `HTTP ${nf.status}`)

  // ===== PASSO 11 — ana: vê o fim do fluxo com toda a documentação (CA-06.2/DEC-018)
  const final = posNf
  const tiposDocumento = (final.documentos ?? []).map((documento) => documento.tipo).sort()
  passo(
    'solicitação CONCLUIDA com NF + comprovante visíveis ao solicitante (DEC-018)',
    final.status === 'CONCLUIDO' && tiposDocumento.includes('NOTA_FISCAL') && tiposDocumento.includes('COMPROVANTE_PAGAMENTO'),
    `status ${final.status} / docs ${tiposDocumento.join(',')}`,
  )

  console.log(`\nRESULTADO: ${passosOk}/${passosTotal} passos ok`)
  console.log(`ID_SOLICITACAO=${id}`)
  if (falhas.length > 0) {
    console.log('FALHAS:')
    for (const falha of falhas) console.log(`- ${falha}`)
    process.exit(1)
  }
}

main().catch((erro) => {
  console.error(`ERRO FATAL: ${erro.message}`)
  process.exit(1)
})
