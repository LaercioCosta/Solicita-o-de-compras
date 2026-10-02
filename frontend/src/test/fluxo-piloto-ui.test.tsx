// E2E-UI do fluxo completo do piloto (Seção 14 da spec) atravessando os perfis na UI.
// Fonte de verdade: docs/acceptance-criteria.md (CA-01 a CA-06, CA-03.5, DEC-018) e
// docs/business-rules.md (RN-01, RN-02, RN-03, RN-04, RN-06). Validação contra os critérios.
// Mapeamento dos perfis do piloto para os fixtures base (test/handlers):
// ana=solicitante@empresa.com (SOLICITANTE), bruno=gerente@ (GERENTE), davi=ti@ (TI),
// carla=gf@ (GERENTE_FINANCEIRA), elisa=financeiro@ (FINANCEIRO).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { File as FileNode } from 'node:buffer' // File usado pelos handlers (instanceof) após o stub global
import { FormData as FormDataNode } from 'undici'
import { renderizarApp, semearSessao } from './utils'
import { SENHA_VALIDA, autorizado, respostaNaoAutorizada } from './handlers'
import { server } from './server'
import type { Notificacao, Orcamento, PagamentoInfo, SolicitacaoDetalhe } from '../types/api'

const ID_PILOTO = 's-piloto'
const SETOR_TI = { id: 'st1', slug: 'TI', nome: 'Tecnologia da Informação' }
const DESCRICAO = 'Impressora multifuncional laser para o setor de TI'
const LINHA_DIGITAVEL = '34191.09008 63541.820047 91020.150008 7 1234567890123456'
const VALOR_PAGO = '379.50'
const PAGO_EM = '2026-09-25T14:00:00.000Z'

// Estado evolutivo compartilhado entre os handlers MSW (a mesma solicitação muda de status).
let piloto: SolicitacaoDetalhe | null = null
let orcamentoAprovadoId: string | null = null
let notificacoes: Notificacao[] = []
const decisoes: Array<{ id: string; corpo: Record<string, unknown> }> = []
const dadosPagamento: Array<{ forma: string; dados: string }> = []
let pagamentoRegistrado: { valorPago: string; nomeArquivo: string } | null = null
const nfAnexadas: Array<string | null> = []

function naoEncontrado() {
  return HttpResponse.json({ message: 'Solicitação não encontrada.', statusCode: 404 }, { status: 404 })
}

function instalarFluxoPiloto(): void {
  piloto = null
  orcamentoAprovadoId = null
  notificacoes = []
  decisoes.length = 0
  dadosPagamento.length = 0
  pagamentoRegistrado = null
  nfAnexadas.length = 0

  server.use(
    http.get('/api/solicitacoes', ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const status = new URL(request.url).searchParams.get('status')
      const lista = piloto ? [piloto] : []
      return HttpResponse.json(status ? lista.filter((item) => item.status === status) : lista)
    }),

    http.get('/api/solicitacoes/:id', ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      if (piloto === null || params.id !== piloto.id) return naoEncontrado()
      return HttpResponse.json(piloto)
    }),

    http.post('/api/solicitacoes', async ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as {
        descricao?: string
        itens?: Array<{ produto: string; quantidade: number; valorUnitarioEstimado: number }>
      }
      piloto = {
        id: ID_PILOTO,
        descricao: corpo.descricao ?? '',
        status: 'RASCUNHO',
        cicloAprovacao: 1,
        solicitanteId: 'u1',
        setorId: SETOR_TI.id,
        setor: SETOR_TI,
        motivoCancelamento: null,
        createdAt: '2026-09-25T12:00:00.000Z',
        updatedAt: '2026-09-25T12:00:00.000Z',
        itens: (corpo.itens ?? []).map((item, indice) => ({
          id: `i${indice + 1}`,
          produto: item.produto,
          quantidade: item.quantidade,
          valorUnitarioEstimado: String(item.valorUnitarioEstimado),
          createdAt: '2026-09-25T12:00:00.000Z',
        })),
        orcamentos: [],
        documentos: [],
        pagamento: null,
        _count: { orcamentos: 0, itens: (corpo.itens ?? []).length },
      }
      return HttpResponse.json(piloto, { status: 201 })
    }),

    http.post('/api/solicitacoes/:id/orcamentos', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as Partial<Orcamento>
      if (piloto === null || params.id !== piloto.id) return naoEncontrado()
      if (!corpo.linkLoja) {
        return HttpResponse.json({ message: 'O link da loja é obrigatório.', statusCode: 400 }, { status: 400 })
      }
      const orcamento: Orcamento = {
        id: `o-piloto-${piloto.orcamentos.length + 1}`,
        linkLoja: corpo.linkLoja,
        cnpjLoja: corpo.cnpjLoja ?? '',
        valor: corpo.valor ?? 0,
        validadeAte: corpo.validadeAte ?? null,
        createdAt: '2026-09-25T12:10:00.000Z',
      }
      piloto.orcamentos.push(orcamento)
      piloto._count.orcamentos = piloto.orcamentos.length
      return HttpResponse.json(orcamento, { status: 201 })
    }),

    http.post('/api/solicitacoes/:id/submeter', ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      if (piloto === null || params.id !== piloto.id) return naoEncontrado()
      if (piloto.orcamentos.length < 3) {
        return HttpResponse.json(
          { message: 'São necessários 3 orçamentos para submeter.', statusCode: 422 },
          { status: 422 },
        )
      }
      piloto.status = 'AGUARDANDO_APROVACAO_SETOR'
      return HttpResponse.json({ status: piloto.status, cicloAprovacao: piloto.cicloAprovacao })
    }),

    http.post('/api/solicitacoes/:id/decisao', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as { orcamentoId?: string; decisao?: 'APROVADO' | 'REPROVADO' }
      if (piloto === null || params.id !== piloto.id) return naoEncontrado()
      decisoes.push({ id: String(params.id), corpo: { orcamentoId: corpo.orcamentoId, decisao: corpo.decisao } })
      if (!piloto.orcamentos.some((orcamento) => orcamento.id === corpo.orcamentoId)) {
        return HttpResponse.json({ message: 'Orçamento não pertence à solicitação.', statusCode: 422 }, { status: 422 })
      }
      if (corpo.decisao === 'REPROVADO') {
        piloto.status = 'REPROVADO'
        return HttpResponse.json({ status: piloto.status })
      }
      if (piloto.status === 'AGUARDANDO_APROVACAO_SETOR') {
        piloto.status = 'AGUARDANDO_APROVACAO_FINANCEIRA' // CA-02.3
      } else if (piloto.status === 'AGUARDANDO_APROVACAO_FINANCEIRA') {
        piloto.status = 'APROVADO' // CA-03.3
        orcamentoAprovadoId = corpo.orcamentoId ?? null
        notificacoes.push({
          // RN-02: a TI só é notificada com os dois níveis aprovados
          id: `n-${notificacoes.length + 1}`,
          mensagem: `Solicitação ${piloto.id} aprovada — a TI pode executar a compra.`,
          lida: false,
          lidaEm: null,
          createdAt: '2026-09-25T13:00:00.000Z',
          solicitacaoId: piloto.id,
        })
      } else {
        // CA-11.2: segunda decisão do mesmo nível na mesma solicitação/ciclo
        return HttpResponse.json({ message: 'Decisão já registrada para este nível.', statusCode: 409 }, { status: 409 })
      }
      return HttpResponse.json({ status: piloto.status })
    }),

    http.post('/api/solicitacoes/:id/compra', ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      if (piloto === null || params.id !== piloto.id) return naoEncontrado()
      piloto.status = 'COMPRA_EM_ANDAMENTO' // CA-04.2
      piloto.compra = { id: 'c-piloto', orcamentoId: orcamentoAprovadoId ?? '' } // RN-03/CA-04.3
      return HttpResponse.json({ ...piloto, orcamentoId: orcamentoAprovadoId })
    }),

    http.post('/api/solicitacoes/:id/pagamento-dados', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as { forma?: string; dados?: string }
      if (piloto === null || params.id !== piloto.id) return naoEncontrado()
      dadosPagamento.push({ forma: corpo.forma ?? '', dados: corpo.dados ?? '' })
      const pagamento: PagamentoInfo = {
        id: 'pg-piloto',
        forma: corpo.forma === 'PIX' ? 'PIX' : 'BOLETO',
        dados: corpo.dados ?? '',
        valorPago: null,
        pagoEm: null,
      }
      piloto.pagamento = pagamento
      piloto.status = 'AGUARDANDO_FINANCEIRO' // CA-05.2
      return HttpResponse.json({ status: piloto.status })
    }),

    http.post('/api/pagamentos/:id/pagar', async ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const formulario = await request.formData()
      const arquivo = formulario.get('arquivo')
      const nomeArquivo = arquivo instanceof File ? arquivo.name : ''
      pagamentoRegistrado = { valorPago: String(formulario.get('valorPago') ?? ''), nomeArquivo }
      piloto?.documentos?.push({
        id: 'doc-comprovante',
        tipo: 'COMPROVANTE_PAGAMENTO',
        nomeOriginal: nomeArquivo,
        mimeType: 'application/pdf',
        tamanhoBytes: 1024,
      })
      if (piloto && piloto.pagamento) {
        piloto.pagamento = { ...piloto.pagamento, valorPago: pagamentoRegistrado.valorPago, pagoEm: PAGO_EM }
        piloto.status = 'PAGO' // CA-05.4
      }
      return HttpResponse.json({
        pagamento: { id: 'pg-piloto', forma: 'BOLETO', dados: LINHA_DIGITAVEL, valorPago: VALOR_PAGO, pagoEm: PAGO_EM },
        documento: { id: 'doc-comprovante', nomeOriginal: nomeArquivo },
      })
    }),

    http.post('/api/solicitacoes/:id/nf', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const formulario = await request.formData()
      const arquivo = formulario.get('arquivo')
      nfAnexadas.push(arquivo instanceof File ? arquivo.name : null)
      if (piloto === null || params.id !== piloto.id) return naoEncontrado()
      piloto.documentos?.push({
        id: 'doc-nf',
        tipo: 'NOTA_FISCAL',
        nomeOriginal: 'nota-fiscal.pdf',
        mimeType: 'application/pdf',
        tamanhoBytes: 2048,
      })
      piloto.status = 'CONCLUIDO' // CA-06.2
      // Contrato real: POST /nf responde 200 (@HttpCode(OK) no documentos.controller),
      // validado contra o backend real na Fase 6 (TASK-063).
      return HttpResponse.json({ id: 'doc-nf' }, { status: 200 })
    }),

    http.get('/api/notificacoes', ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      return HttpResponse.json(notificacoes)
    }),
  )
}

beforeAll(() => {
  vi.stubGlobal('FormData', FormDataNode)
  vi.stubGlobal('File', FileNode)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('fluxo completo do piloto na UI (Seção 14 da spec)', () => {
  it('atravessa os 5 perfis: cria, aprova em 2 níveis, compra, paga, anexa NF e conclui', { timeout: 30000 }, async () => {
    instalarFluxoPiloto()
    const usuario = userEvent.setup()

    // ===== PASSO 1 — SOLICITANTE (ana): login mock → dashboard → nova → cria → 3 orçamentos → submete
    let tela = renderizarApp('/')
    expect(await screen.findByText('Entre com suas credenciais para acessar')).toBeInTheDocument()
    await usuario.type(screen.getByLabelText('E-mail'), 'solicitante@empresa.com')
    await usuario.type(screen.getByLabelText('Senha'), SENHA_VALIDA)
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    // dashboard com cards por perfil e atalhos
    expect(await screen.findByText('Bem-vindo(a), João Souza.')).toBeInTheDocument()
    expect(screen.getByText('Rascunhos')).toBeInTheDocument()
    expect(screen.getByText('Concluídas')).toBeInTheDocument()
    const [atalhoNova] = screen.getAllByRole('link', { name: 'Nova solicitação' })
    await usuario.click(atalhoNova)

    // nova solicitação: descrição + 1 item → cria (POST)
    await usuario.type(await screen.findByLabelText('Descrição'), DESCRICAO)
    await usuario.type(screen.getByLabelText('Produto 1'), 'Impressora multifuncional laser')
    await usuario.type(screen.getByLabelText('Quantidade'), '1')
    await usuario.type(screen.getByLabelText('Valor unitário (R$)'), '450.00')
    await usuario.click(screen.getByRole('button', { name: 'Criar solicitação' }))

    expect(await screen.findByText('Solicitação criada com sucesso.')).toBeInTheDocument()
    expect(await screen.findByText(`Solicitação ${ID_PILOTO}`)).toBeInTheDocument()
    expect(await screen.findByText('Ações do solicitante')).toBeInTheDocument()
    expect(screen.getByTestId('etapa-atual')).toHaveTextContent('Rascunho')
    expect(piloto?.status).toBe('RASCUNHO') // CA-01.1
    expect(piloto?.solicitanteId).toBe('u1')

    // adiciona 3 orçamentos pelo painel AcoesSolicitante (RN-01: com link da loja)
    const links = [
      'https://loja-a.example.com/impressora',
      'https://loja-b.example.com/impressora',
      'https://loja-c.example.com/impressora',
    ]
    const valores = ['449.00', '379.50', '429.00']
    for (let indice = 0; indice < 3; indice += 1) {
      await usuario.click(screen.getByRole('button', { name: `Adicionar orçamento (${indice}/3)` }))
      const dialogo = screen.getByRole('dialog', { name: 'Adicionar orçamento' })
      await usuario.type(within(dialogo).getByLabelText('Link da loja'), links[indice])
      fireEvent.change(within(dialogo).getByLabelText('CNPJ da loja'), { target: { value: '12345678000199' } })
      await usuario.type(within(dialogo).getByLabelText('Valor (R$)'), valores[indice])
      await usuario.click(within(dialogo).getByRole('button', { name: 'Adicionar orçamento' }))
      await screen.findByRole('button', { name: `Adicionar orçamento (${indice + 1}/3)` })
      if (indice === 1) {
        // CA-01.2/RN-01: sem 3 orçamentos não é possível submeter
        const botaoSubmeter = screen.getByRole('button', { name: 'Submeter' })
        expect(botaoSubmeter).toBeDisabled()
        expect(botaoSubmeter.closest('span')).toHaveAttribute('title', 'exige 3 orçamentos')
      }
    }
    // cada valor aparece 2x: na lista do painel AcoesSolicitante e no card Orçamentos (DEC-018: dono vê valores)
    expect(screen.getAllByText('R$ 449,00')).toHaveLength(2)
    expect(screen.getAllByText('R$ 379,50')).toHaveLength(2)
    expect(screen.getAllByText('R$ 429,00')).toHaveLength(2)
    expect(piloto?.orcamentos).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Submeter' })).toBeEnabled()

    // submete → AGUARDANDO_APROVACAO_SETOR (CA-01.4)
    await usuario.click(screen.getByRole('button', { name: 'Submeter' }))
    await usuario.click(
      within(screen.getByRole('dialog', { name: 'Submeter para aprovação' })).getByRole('button', {
        name: 'Confirmar',
      }),
    )
    expect(await screen.findByText('Solicitação enviada para aprovação.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('etapa-atual')).toHaveTextContent('Aguardando aprovação do setor'))
    expect(piloto?.status).toBe('AGUARDANDO_APROVACAO_SETOR') // CA-01.4
    // dono em AGUARDANDO_APROVACAO_SETOR vê o aviso de alteração relevante (CA-13/DEC-015)
    expect(screen.getByText('Atenção: qualquer alteração reabre o ciclo de aprovação (DEC-015/DEC-027).')).toBeInTheDocument()

    // ===== PASSO 2 — GERENTE (bruno): /aprovacoes fila de setor → aprova orçamento 1 → CA-02
    tela.unmount()
    semearSessao('GERENTE')
    tela = renderizarApp('/aprovacoes')

    const linhaSetor = await screen.findByRole('row', { name: /Impressora multifuncional laser/ })
    expect(screen.getByRole('tab', { name: 'Aprovação de setor' })).toHaveAttribute('aria-selected', 'true')
    expect(within(linhaSetor).getByText('Tecnologia da Informação')).toBeInTheDocument() // CA-02.1 setor do solicitante
    await usuario.click(within(linhaSetor).getByRole('button', { name: 'Analisar' }))

    const dialogoSetor = await screen.findByRole('dialog', { name: `Analisar ${ID_PILOTO}` })
    await within(dialogoSetor).findByText(DESCRICAO)
    const aprovarSetor = within(dialogoSetor).getByRole('button', { name: 'Aprovar' })
    expect(aprovarSetor).toBeDisabled() // RN-06: decisão exige orçamento vinculado
    await usuario.click(within(dialogoSetor).getByRole('radio', { name: /449,00/ })) // orçamento 1
    expect(aprovarSetor).toBeEnabled()
    await usuario.click(aprovarSetor)

    expect(await screen.findByText('Aprovada e registrada.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Impressora multifuncional laser/ })).not.toBeInTheDocument(),
    )
    expect(piloto?.status).toBe('AGUARDANDO_APROVACAO_FINANCEIRA') // CA-02.3
    expect(decisoes).toEqual([{ id: ID_PILOTO, corpo: { orcamentoId: 'o-piloto-1', decisao: 'APROVADO' } }])

    // ===== PASSO 3 — TI (davi): /notificacoes vazia ANTES do 2º nível (CA-03.5)
    tela.unmount()
    semearSessao('TI')
    tela = renderizarApp('/notificacoes')

    expect(await screen.findByText('Nenhuma notificação')).toBeInTheDocument() // CA-03.5
    expect(screen.getByText('Você não possui notificações no momento.')).toBeInTheDocument()
    expect(notificacoes).toEqual([])

    // ===== PASSO 4 — GF (carla): /aprovacoes aba financeira → aprova orçamento 2 → APROVADO (CA-03)
    tela.unmount()
    semearSessao('GERENTE_FINANCEIRA')
    tela = renderizarApp('/aprovacoes')

    const linhaFinanceira = await screen.findByRole('row', { name: /Impressora multifuncional laser/ })
    expect(screen.getByRole('tab', { name: 'Aprovação financeira' })).toHaveAttribute('aria-selected', 'true') // CA-03.1
    await usuario.click(within(linhaFinanceira).getByRole('button', { name: 'Analisar' }))

    const dialogoFinanceira = await screen.findByRole('dialog', { name: `Analisar ${ID_PILOTO}` })
    await within(dialogoFinanceira).findByText(DESCRICAO)
    await usuario.click(within(dialogoFinanceira).getByRole('radio', { name: /379,50/ })) // orçamento 2 (CA-03.2)
    await usuario.click(within(dialogoFinanceira).getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText('Aprovada e registrada.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Impressora multifuncional laser/ })).not.toBeInTheDocument(),
    )
    expect(piloto?.status).toBe('APROVADO') // CA-03.3
    expect(decisoes[1]).toEqual({ id: ID_PILOTO, corpo: { orcamentoId: 'o-piloto-2', decisao: 'APROVADO' } })

    // ===== PASSO 5 — TI (davi): notificações ≥1 → /ti → compra → pagamento-dados BOLETO
    tela.unmount()
    semearSessao('TI')
    tela = renderizarApp('/notificacoes')

    expect(await screen.findByText(`Solicitação ${ID_PILOTO} aprovada — a TI pode executar a compra.`)).toBeInTheDocument() // RN-02/CA-03.3
    expect(screen.getAllByRole('button', { name: 'Marcar como lida' })).toHaveLength(1)

    tela.unmount()
    tela = renderizarApp('/ti')

    const filaAprovadas = await screen.findByTestId('fila-APROVADO')
    expect(await within(filaAprovadas).findByText(DESCRICAO)).toBeInTheDocument() // CA-04.1
    await usuario.click(within(filaAprovadas).getByRole('button', { name: 'Executar compra' }))

    const dialogoCompra = await screen.findByRole('dialog', { name: 'Executar compra' })
    expect(await within(dialogoCompra).findByText(DESCRICAO)).toBeInTheDocument()
    expect(
      within(dialogoCompra).getByText('A compra usará o orçamento escolhido pela aprovação financeira.'),
    ).toBeInTheDocument() // CA-04.3/RN-03
    await usuario.click(within(dialogoCompra).getByRole('button', { name: 'Confirmar compra' }))

    expect(await screen.findByText('Compra iniciada')).toBeInTheDocument() // CA-04.2
    expect(piloto?.status).toBe('COMPRA_EM_ANDAMENTO')
    const andamento = screen.getByTestId('fila-COMPRA_EM_ANDAMENTO')
    await waitFor(() =>
      expect(within(screen.getByTestId('fila-APROVADO')).queryByText(DESCRICAO)).not.toBeInTheDocument(),
    )
    expect(await within(andamento).findByText(DESCRICAO)).toBeInTheDocument()

    await usuario.click(within(andamento).getByRole('button', { name: 'Registrar dados de pagamento' }))
    const dialogoDados = await screen.findByRole('dialog', { name: 'Registrar dados de pagamento' })
    await usuario.type(within(dialogoDados).getByLabelText('Linha digitável / código do boleto'), LINHA_DIGITAVEL)
    await usuario.click(within(dialogoDados).getByRole('button', { name: 'Enviar ao Financeiro' }))

    expect(await screen.findByText('Enviado ao Financeiro (AGUARDANDO_FINANCEIRO)')).toBeInTheDocument()
    expect(piloto?.status).toBe('AGUARDANDO_FINANCEIRO') // CA-05.2
    expect(piloto?.pagamento).toEqual({
      id: 'pg-piloto',
      forma: 'BOLETO',
      dados: LINHA_DIGITAVEL,
      valorPago: null,
      pagoEm: null,
    }) // CA-05.1
    expect(dadosPagamento).toEqual([{ forma: 'BOLETO', dados: LINHA_DIGITAVEL }])
    await waitFor(() => expect(within(andamento).queryByText(DESCRICAO)).not.toBeInTheDocument())

    // ===== PASSO 6 — FINANCEIRO (elisa): /pagamentos → paga com valor + comprovante → PAGO
    tela.unmount()
    semearSessao('FINANCEIRO')
    tela = renderizarApp('/pagamentos')

    const cartao = await screen.findByTestId(`item-fila-${ID_PILOTO}`)
    expect(within(cartao).getByText('Boleto')).toBeInTheDocument()
    expect(within(cartao).getByText(LINHA_DIGITAVEL)).toBeInTheDocument() // CA-05.1: dados visíveis ao pagador
    await usuario.click(within(cartao).getByRole('button', { name: 'Registrar pagamento' }))

    const dialogoPagar = within(screen.getByRole('dialog'))
    await usuario.type(dialogoPagar.getByLabelText('Valor pago (R$)'), VALOR_PAGO)
    await usuario.upload(
      dialogoPagar.getByLabelText('Comprovante'),
      new File(['conteudo'], 'comprovante.pdf', { type: 'application/pdf' }),
    )
    await usuario.click(dialogoPagar.getByRole('button', { name: 'Registrar pagamento' }))

    expect(await screen.findByText('Pagamento registrado')).toBeInTheDocument() // CA-05.4
    await waitFor(() => expect(screen.queryByTestId(`item-fila-${ID_PILOTO}`)).not.toBeInTheDocument())
    expect(piloto?.status).toBe('PAGO') // CA-05.4
    expect(pagamentoRegistrado).toEqual({ valorPago: VALOR_PAGO, nomeArquivo: 'comprovante.pdf' }) // CA-05.3/5

    // DEC-018: valorPago visível para envolvida no /pagamentos histórico (status PAGO)
    await usuario.click(screen.getByRole('tab', { name: 'Histórico' }))
    const historico = await screen.findByTestId(`item-historico-${ID_PILOTO}`)
    expect(within(historico).getByText(DESCRICAO)).toBeInTheDocument()
    expect(within(historico).getByText(`Pago em ${'25/09/2026'}`)).toBeInTheDocument()
    expect(within(historico).getByText('R$ 379,50')).toBeInTheDocument() // DEC-018

    // ===== PASSO 7 — TI (davi): /ti fila AGUARDANDO NF (PAGO) → anexa NF → CONCLUIDO
    tela.unmount()
    semearSessao('TI')
    tela = renderizarApp('/ti')

    const aguardandoNf = await screen.findByTestId('fila-PAGO')
    expect(await within(aguardandoNf).findByText(DESCRICAO)).toBeInTheDocument()
    await usuario.click(within(aguardandoNf).getByRole('button', { name: 'Anexar nota fiscal' }))

    const dialogoNf = screen.getByRole('dialog', { name: 'Anexar nota fiscal' })
    await usuario.upload(
      within(dialogoNf).getByLabelText('Arquivo da nota fiscal'),
      new File(['%PDF-1.4'], 'nota-fiscal.pdf', { type: 'application/pdf' }),
    )
    expect(within(dialogoNf).getByText('Selecionado: nota-fiscal.pdf')).toBeInTheDocument()
    await usuario.click(within(dialogoNf).getByRole('button', { name: 'Anexar arquivo' }))

    expect(await screen.findByText('Nota fiscal anexada — compra concluída')).toBeInTheDocument() // CA-06.2
    await waitFor(() =>
      expect(within(screen.getByTestId('fila-PAGO')).queryByText(DESCRICAO)).not.toBeInTheDocument(),
    )
    expect(piloto?.status).toBe('CONCLUIDO') // CA-06.2
    expect(nfAnexadas).toEqual(['nota-fiscal.pdf'])

    // ===== PASSO 8 — asserts finais: DEC-018 (documentos/valores visíveis) + painel correto por perfil
    tela.unmount()
    semearSessao('SOLICITANTE') // ana, envolvida, vê o fluxo dela até o fim
    tela = renderizarApp(`/solicitacoes/${ID_PILOTO}`)

    expect(await screen.findByTestId('etapa-atual')).toHaveTextContent('Concluído')
    expect(screen.getByText('nota-fiscal.pdf')).toBeInTheDocument() // DEC-018: NF visível
    expect(screen.getByText('comprovante.pdf')).toBeInTheDocument() // DEC-018: comprovante visível
    expect(screen.getByText('Nota fiscal')).toBeInTheDocument()
    expect(screen.getByText('Comprovante de pagamento')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Baixar' })).toHaveLength(2) // downloads disponíveis
    // painel correto por perfil: dono em CONCLUIDO vê bloqueio de edição, sem botões de edição/submissão
    expect(screen.getByText('Solicitação bloqueada para edição (DEC-027).')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submeter' })).not.toBeInTheDocument()
    // a compra usou o orçamento aprovado pela Gerente Financeira (RN-03/CA-04.3)
    expect(piloto?.compra?.orcamentoId).toBe('o-piloto-2')
    tela.unmount()
  })
})
