import { http, HttpResponse } from 'msw'
import { autorizado, respostaNaoAutorizada } from '../../test/handlers'
import type { SolicitacaoDetalhe } from '../../types/api'

interface OpcoesHandler {
  status?: number
  mensagem?: string
  resposta?: unknown
  aoReceber?: (corpo: unknown) => void
}

export const SOLICITACAO_CRIADA_ID = 's99'

export function handlerCriarSolicitacao(opcoes: OpcoesHandler = {}) {
  return http.post('/api/solicitacoes', async ({ request }) => {
    if (!autorizado(request)) return respostaNaoAutorizada()
    const corpo = (await request.json()) as Record<string, unknown>
    opcoes.aoReceber?.(corpo)
    if (opcoes.status && opcoes.status !== 201) {
      return HttpResponse.json(
        { message: opcoes.mensagem ?? 'Dados inválidos.' },
        { status: opcoes.status },
      )
    }
    return HttpResponse.json(
      {
        id: SOLICITACAO_CRIADA_ID,
        descricao: corpo.descricao,
        status: 'RASCUNHO',
        cicloAprovacao: 1,
        solicitanteId: 'u1',
        setorId: 'st1',
        motivoCancelamento: null,
        createdAt: '2026-09-25T12:00:00.000Z',
        updatedAt: '2026-09-25T12:00:00.000Z',
        itens: [],
        orcamentos: [],
        _count: { orcamentos: 0, itens: 0 },
      },
      { status: 201 },
    )
  })
}

export function handlerDetalheCriada(resposta: SolicitacaoDetalhe) {
  return http.get(`/api/solicitacoes/${SOLICITACAO_CRIADA_ID}`, ({ request }) => {
    if (!autorizado(request)) return respostaNaoAutorizada()
    return HttpResponse.json(resposta)
  })
}

export function handlerEditarSolicitacao(opcoes: OpcoesHandler = {}) {
  return http.patch('/api/solicitacoes/:id', async ({ request, params }) => {
    if (!autorizado(request)) return respostaNaoAutorizada()
    const corpo = (await request.json()) as Record<string, unknown>
    opcoes.aoReceber?.(corpo)
    if (opcoes.status && opcoes.status !== 200) {
      return HttpResponse.json(
        { message: opcoes.mensagem ?? 'Não foi possível atualizar a solicitação.' },
        { status: opcoes.status },
      )
    }
    return HttpResponse.json(opcoes.resposta ?? { id: String(params.id) })
  })
}

export function handlerAdicionarOrcamento(opcoes: OpcoesHandler = {}) {
  return http.post('/api/solicitacoes/:id/orcamentos', async ({ request }) => {
    if (!autorizado(request)) return respostaNaoAutorizada()
    const corpo = (await request.json()) as Record<string, unknown>
    opcoes.aoReceber?.(corpo)
    if (opcoes.status && opcoes.status !== 201) {
      return HttpResponse.json(
        { message: opcoes.mensagem ?? 'Não foi possível adicionar o orçamento.' },
        { status: opcoes.status },
      )
    }
    return HttpResponse.json(
      {
        id: 'o-novo',
        linkLoja: corpo.linkLoja,
        cnpjLoja: corpo.cnpjLoja,
        valor: corpo.valor,
        validadeAte: corpo.validadeAte ?? null,
        createdAt: '2026-09-25T12:00:00.000Z',
      },
      { status: 201 },
    )
  })
}

export function handlerEditarOrcamento(opcoes: OpcoesHandler = {}) {
  return http.patch('/api/solicitacoes/:id/orcamentos/:orcamentoId', async ({ request }) => {
    if (!autorizado(request)) return respostaNaoAutorizada()
    const corpo = (await request.json()) as Record<string, unknown>
    opcoes.aoReceber?.(corpo)
    if (opcoes.status && opcoes.status !== 200) {
      return HttpResponse.json(
        { message: opcoes.mensagem ?? 'Não foi possível atualizar o orçamento.' },
        { status: opcoes.status },
      )
    }
    return HttpResponse.json({ id: 'o1', ...corpo })
  })
}

export function handlerSubmeter(opcoes: OpcoesHandler = {}) {
  return http.post('/api/solicitacoes/:id/submeter', ({ request }) => {
    if (!autorizado(request)) return respostaNaoAutorizada()
    opcoes.aoReceber?.({})
    if (opcoes.status && opcoes.status !== 200) {
      return HttpResponse.json(
        { message: opcoes.mensagem ?? 'Não foi possível submeter a solicitação.' },
        { status: opcoes.status },
      )
    }
    return HttpResponse.json(
      opcoes.resposta ?? { status: 'AGUARDANDO_APROVACAO_SETOR', cicloAprovacao: 1 },
    )
  })
}

export function handlerCancelar(opcoes: OpcoesHandler = {}) {
  return http.post('/api/solicitacoes/:id/cancelar', async ({ request }) => {
    if (!autorizado(request)) return respostaNaoAutorizada()
    const corpo = (await request.json()) as Record<string, unknown>
    opcoes.aoReceber?.(corpo)
    if (opcoes.status && opcoes.status !== 200) {
      return HttpResponse.json(
        { message: opcoes.mensagem ?? 'Não foi possível cancelar a solicitação.' },
        { status: opcoes.status },
      )
    }
    return HttpResponse.json(opcoes.resposta ?? { status: 'CANCELADO' })
  })
}
