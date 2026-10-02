import { http, HttpResponse } from 'msw'
import { autorizado, respostaNaoAutorizada } from '../../test/handlers'
import type { PagamentoInfo, SolicitacaoDetalhe, SolicitacaoResumo } from '../../types/api'

export const DADOS_BOLETO = '34191.79001 01043.510047 91020.150008 3 91960000012935'
export const DADOS_PIX =
  '00020126580014BR.GOV.BCB.PIX0136a1b2c3d4-e5f6-7890-abcd-ef12345678905204000053039865802BR5913EMPRESA DEMO6009SAO PAULO62070503***6304D1A2'

const base = {
  solicitanteId: 'u1',
  setorId: 'st1',
  motivoCancelamento: null as string | null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-20T14:30:00.000Z',
}

export const pagamentoBoleto: PagamentoInfo = {
  id: 'pg-boleto',
  forma: 'BOLETO',
  dados: DADOS_BOLETO,
  valorPago: null,
  pagoEm: null,
}

export const pagamentoPix: PagamentoInfo = {
  id: 'pg-pix',
  forma: 'PIX',
  dados: DADOS_PIX,
  valorPago: null,
  pagoEm: null,
}

export const pagamentoPago: PagamentoInfo = {
  id: 'pg-pago',
  forma: 'PIX',
  dados: DADOS_PIX,
  valorPago: '1250.50',
  pagoEm: '2026-09-22T12:00:00.000Z',
}

const resumoBoleto: SolicitacaoResumo = {
  id: 'sol-boleto',
  descricao: 'Notebook para o setor financeiro',
  status: 'AGUARDANDO_FINANCEIRO',
  cicloAprovacao: 1,
  _count: { orcamentos: 3, itens: 2 },
  ...base,
}

const resumoPix: SolicitacaoResumo = {
  id: 'sol-pix',
  descricao: 'Licença de software contábil',
  status: 'AGUARDANDO_FINANCEIRO',
  cicloAprovacao: 1,
  _count: { orcamentos: 3, itens: 1 },
  ...base,
}

const resumoSemPagamento: SolicitacaoResumo = {
  id: 'sol-sem-pagamento',
  descricao: 'Cadeiras para a recepção',
  status: 'AGUARDANDO_FINANCEIRO',
  cicloAprovacao: 1,
  _count: { orcamentos: 2, itens: 1 },
  ...base,
}

const resumoPago: SolicitacaoResumo = {
  id: 'sol-pago',
  descricao: 'Monitor para estação de trabalho',
  status: 'PAGO',
  cicloAprovacao: 1,
  _count: { orcamentos: 3, itens: 1 },
  ...base,
}

function montarDetalhe(resumo: SolicitacaoResumo, pagamento?: PagamentoInfo): SolicitacaoDetalhe {
  const detalhe: SolicitacaoDetalhe = {
    ...resumo,
    itens: [
      {
        id: `item-${resumo.id}`,
        produto: 'Item de teste',
        quantidade: 1,
        valorUnitarioEstimado: '1250.50',
        createdAt: resumo.createdAt,
      },
    ],
    orcamentos: [],
  }
  if (pagamento) {
    detalhe.pagamento = pagamento
  }
  return detalhe
}

const detalhes: Record<string, SolicitacaoDetalhe> = {
  'sol-boleto': montarDetalhe(resumoBoleto, pagamentoBoleto),
  'sol-pix': montarDetalhe(resumoPix, pagamentoPix),
  'sol-sem-pagamento': montarDetalhe(resumoSemPagamento),
  'sol-pago': montarDetalhe(resumoPago, pagamentoPago),
}

const resumos = [resumoBoleto, resumoPix, resumoSemPagamento, resumoPago]

export interface PagamentoRecebido {
  url: string
  valorPago: string
  nomeArquivo: string
}

export interface OpcoesPagar {
  statusResposta?: number
  mensagemErro?: string
}

export function criarHandlersPagamentos(opcoes: OpcoesPagar = {}) {
  const recebidos: PagamentoRecebido[] = []
  const handlers = [
    http.get('/api/solicitacoes', ({ request }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      const status = new URL(request.url).searchParams.get('status')
      return HttpResponse.json(resumos.filter((resumo) => status === null || resumo.status === status))
    }),
    http.get('/api/solicitacoes/:id', ({ request, params }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      const detalhe = detalhes[params.id as string]
      if (!detalhe) {
        return HttpResponse.json(
          { message: 'Solicitação não encontrada.', statusCode: 404 },
          { status: 404 },
        )
      }
      return HttpResponse.json(detalhe)
    }),
    http.post('/api/pagamentos/:id/pagar', async ({ request }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      const formulario = await request.formData()
      const arquivo = formulario.get('arquivo')
      recebidos.push({
        url: request.url,
        valorPago: String(formulario.get('valorPago') ?? ''),
        nomeArquivo: arquivo instanceof File ? arquivo.name : '',
      })
      if (opcoes.statusResposta !== undefined) {
        return HttpResponse.json(
          { message: opcoes.mensagemErro ?? 'Erro ao registrar o pagamento.', statusCode: opcoes.statusResposta },
          { status: opcoes.statusResposta },
        )
      }
      return HttpResponse.json({
        pagamento: { ...pagamentoBoleto, valorPago: '1250.50', pagoEm: '2026-09-25T12:00:00.000Z' },
        documento: { id: 'doc-1', nomeOriginal: arquivo instanceof File ? arquivo.name : 'comprovante.pdf' },
      })
    }),
  ]
  return { handlers, recebidos }
}
