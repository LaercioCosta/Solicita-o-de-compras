import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { renderizarApp, semearSessao } from '../../test/utils'
import { autorizado, respostaNaoAutorizada } from '../../test/handlers'
import { server } from '../../test/server'
import type { EstadoSolicitacao, SolicitacaoDetalhe } from '../../types/api'

function criarDetalhe(
  id: string,
  descricao: string,
  status: EstadoSolicitacao,
  produto: string,
  orcamentos: Array<{ id: string; valor: string }>,
): SolicitacaoDetalhe {
  return {
    id,
    descricao,
    status,
    cicloAprovacao: 1,
    solicitanteId: 'u1',
    setorId: 'st1',
    setor: { id: 'st1', slug: 'TI', nome: 'Tecnologia da Informação' },
    motivoCancelamento: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-10T14:30:00.000Z',
    itens: [
      {
        id: `${id}-item`,
        produto,
        quantidade: 3,
        valorUnitarioEstimado: '400.00',
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    ],
    orcamentos: orcamentos.map((orcamento) => ({
      id: orcamento.id,
      linkLoja: `https://loja.example.com/${orcamento.id}`,
      cnpjLoja: '12345678000199',
      valor: orcamento.valor,
      validadeAte: null,
      createdAt: '2026-09-02T09:00:00.000Z',
    })),
    _count: { orcamentos: orcamentos.length, itens: 1 },
  }
}

function detalhesIniciais(): SolicitacaoDetalhe[] {
  return [
    criarDetalhe('s3', 'Licenças de software de design', 'AGUARDANDO_APROVACAO_SETOR', 'Licença Figma anual', [
      { id: 'o3a', valor: '1200.00' },
      { id: 'o3b', valor: '980.50' },
    ]),
    criarDetalhe('s4', 'Cadeiras ergonômicas para o time', 'AGUARDANDO_APROVACAO_SETOR', 'Cadeira ergonômica', [
      { id: 'o4a', valor: '3200.00' },
    ]),
    criarDetalhe('s5', 'Monitor 27 para estação de trabalho', 'AGUARDANDO_APROVACAO_SETOR', 'Monitor LG 27', [
      { id: 'o5a', valor: '1899.00' },
    ]),
    criarDetalhe('s7', 'Curso online de certificação', 'AGUARDANDO_APROVACAO_FINANCEIRA', 'Curso PMP', [
      { id: 'o7a', valor: '1500.00' },
    ]),
  ]
}

type RespostaInterceptada = { status: number; mensagem?: string }

type Interceptador = (id: string, corpo: Record<string, unknown>) => RespostaInterceptada | undefined

interface Capturas {
  decisao: Array<{ id: string; corpo: Record<string, unknown> }>
  devolucao: Array<{ id: string; corpo: Record<string, unknown> }>
}

interface OpcoesAprovacoes {
  inicial?: SolicitacaoDetalhe[]
  aoDecidir?: Interceptador
  aoDevolver?: Interceptador
}

function instalarAprovacoes(opcoes: OpcoesAprovacoes = {}): Capturas {
  const capturas: Capturas = { decisao: [], devolucao: [] }
  const itens = (opcoes.inicial ?? detalhesIniciais()).map((item) => ({ ...item }))

  server.use(
    http.get('/api/solicitacoes', ({ request }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      const url = new URL(request.url)
      const status = url.searchParams.get('status')
      const limit = Number(url.searchParams.get('limit') ?? '100')
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const filtradas = itens.filter((item) => status === null || item.status === status)
      return HttpResponse.json(filtradas.slice(offset, offset + limit))
    }),
    http.get('/api/solicitacoes/:id', ({ request, params }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      const item = itens.find((atual) => atual.id === String(params.id))
      if (item === undefined) {
        return HttpResponse.json({ message: 'Solicitação não encontrada.', statusCode: 404 }, { status: 404 })
      }
      return HttpResponse.json(item)
    }),
    http.post('/api/solicitacoes/:id/decisao', async ({ request, params }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      const corpo = (await request.json()) as Record<string, unknown>
      const id = String(params.id)
      capturas.decisao.push({ id, corpo })
      const interceptado = opcoes.aoDecidir?.(id, corpo)
      if (interceptado !== undefined) {
        return HttpResponse.json(
          { message: interceptado.mensagem ?? 'Erro.', statusCode: interceptado.status },
          { status: interceptado.status },
        )
      }
      const item = itens.find((atual) => atual.id === id)
      if (item === undefined) {
        return HttpResponse.json({ message: 'Solicitação não encontrada.', statusCode: 404 }, { status: 404 })
      }
      if (!item.orcamentos.some((orcamento) => orcamento.id === corpo.orcamentoId)) {
        return HttpResponse.json(
          { message: 'Orçamento não pertence à solicitação.', statusCode: 422 },
          { status: 422 },
        )
      }
      if (corpo.decisao === 'APROVADO') {
        item.status =
          item.status === 'AGUARDANDO_APROVACAO_SETOR' ? 'AGUARDANDO_APROVACAO_FINANCEIRA' : 'APROVADO'
      } else {
        item.status = 'REPROVADO'
      }
      return HttpResponse.json({ status: item.status })
    }),
    http.post('/api/solicitacoes/:id/devolver-correcao', async ({ request, params }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      const corpo = (await request.json()) as Record<string, unknown>
      const id = String(params.id)
      capturas.devolucao.push({ id, corpo })
      const interceptado = opcoes.aoDevolver?.(id, corpo)
      if (interceptado !== undefined) {
        return HttpResponse.json(
          { message: interceptado.mensagem ?? 'Erro.', statusCode: interceptado.status },
          { status: interceptado.status },
        )
      }
      const item = itens.find((atual) => atual.id === id)
      if (item === undefined) {
        return HttpResponse.json({ message: 'Solicitação não encontrada.', statusCode: 404 }, { status: 404 })
      }
      item.status = 'AGUARDANDO_CORRECAO'
      return HttpResponse.json({ status: item.status })
    }),
  )

  return capturas
}

describe('fila de aprovações por nível', () => {
  it('exibe skeleton na carga, pendências do setor e abas conforme o perfil', async () => {
    instalarAprovacoes()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    expect(await screen.findByText('Licenças de software de design')).toBeInTheDocument()
    expect(screen.getByText('Cadeiras ergonômicas para o time')).toBeInTheDocument()
    expect(screen.getAllByText('Tecnologia da Informação')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Analisar' })).toHaveLength(3)
    expect(screen.getByRole('tab', { name: 'Aprovação de setor' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Aprovação financeira' })).not.toBeInTheDocument()
  })

  it('exibe estado vazio quando não há pendências no nível', async () => {
    instalarAprovacoes({ inicial: [] })
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    expect(await screen.findByText('Nada pendente — tudo em dia')).toBeInTheDocument()
  })

  it('exibe skeleton na fila durante a carga do nível', async () => {
    instalarAprovacoes()
    server.use(
      http.get('/api/solicitacoes', async ({ request }) => {
        if (!autorizado(request)) {
          return respostaNaoAutorizada()
        }
        await delay(100)
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const filtradas = detalhesIniciais().filter((item) => status === null || item.status === status)
        return HttpResponse.json(filtradas)
      }),
    )
    const usuario = userEvent.setup()
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/aprovacoes')

    expect(await screen.findByText('Curso online de certificação')).toBeInTheDocument()
    await usuario.click(screen.getByRole('tab', { name: 'Aprovação de setor' }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByText('Licenças de software de design')).toBeInTheDocument()
  })

  it('aprova vinculando o orçamento escolhido e atualiza a fila', async () => {
    const capturas = instalarAprovacoes()
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Licenças de software de design/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Licença Figma anual')).toBeInTheDocument()
    await usuario.click(within(dialog).getByRole('radio', { name: /1\.200,00/ }))
    await usuario.click(within(dialog).getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText('Aprovada e registrada.')).toBeInTheDocument()
    expect(capturas.decisao).toEqual([{ id: 's3', corpo: { orcamentoId: 'o3a', decisao: 'APROVADO' } }])
    await waitFor(() => expect(screen.queryByText('Licenças de software de design')).not.toBeInTheDocument())
  })

  it('reprova com observação e envia o orçamento vinculado', async () => {
    const capturas = instalarAprovacoes()
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Cadeiras ergonômicas/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    await usuario.click(await within(dialog).findByRole('radio', { name: /3\.200,00/ }))
    await usuario.type(within(dialog).getByLabelText('Observação (opcional)'), 'Orçamento acima do planejado')
    await usuario.click(within(dialog).getByRole('button', { name: 'Reprovar' }))

    expect(await screen.findByText('Reprovada e registrada.')).toBeInTheDocument()
    expect(capturas.decisao).toEqual([
      {
        id: 's4',
        corpo: { orcamentoId: 'o4a', decisao: 'REPROVADO', observacao: 'Orçamento acima do planejado' },
      },
    ])
  })

  it('devolve para correção com motivo e remove a solicitação da fila', async () => {
    const capturas = instalarAprovacoes()
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Monitor 27/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    await usuario.click(await within(dialog).findByRole('button', { name: 'Devolver para correção' }))

    const modalMotivo = screen.getByRole('dialog', { name: 'Devolver para correção' })
    await usuario.type(within(modalMotivo).getByLabelText('Motivo da devolução'), 'Anexe o orçamento atualizado')
    await usuario.click(within(modalMotivo).getByRole('button', { name: 'Confirmar devolução' }))

    expect(await screen.findByText('Solicitação devolvida para correção.')).toBeInTheDocument()
    expect(capturas.devolucao).toEqual([{ id: 's5', corpo: { motivo: 'Anexe o orçamento atualizado' } }])
    await waitFor(() =>
      expect(screen.queryByText('Monitor 27 para estação de trabalho')).not.toBeInTheDocument(),
    )
  })

  it('exige motivo preenchido para devolver', async () => {
    const capturas = instalarAprovacoes()
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Monitor 27/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    await usuario.click(await within(dialog).findByRole('button', { name: 'Devolver para correção' }))

    const modalMotivo = screen.getByRole('dialog', { name: 'Devolver para correção' })
    await usuario.click(within(modalMotivo).getByRole('button', { name: 'Confirmar devolução' }))

    expect(await screen.findByText('Informe o motivo da devolução (1 a 1000 caracteres).')).toBeInTheDocument()
    expect(capturas.devolucao).toHaveLength(0)
  })

  it('exige seleção de orçamento para habilitar a decisão', async () => {
    instalarAprovacoes()
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Licenças de software de design/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    const aprovar = await within(dialog).findByRole('button', { name: 'Aprovar' })
    expect(aprovar).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Reprovar' })).toBeDisabled()

    await usuario.click(within(dialog).getByRole('radio', { name: /1\.200,00/ }))
    expect(aprovar).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Reprovar' })).toBeEnabled()
  })

  it('exibe mensagem da DEC-022 quando a decisão já foi registrada (409)', async () => {
    instalarAprovacoes({
      aoDecidir: () => ({ status: 409, mensagem: 'Decisão já registrada para este nível.' }),
    })
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Licenças de software de design/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    await usuario.click(await within(dialog).findByRole('radio', { name: /1\.200,00/ }))
    await usuario.click(within(dialog).getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText('Decisão já registrada para este nível.')).toBeInTheDocument()
  })

  it('exibe mensagem clara quando a solicitação não está disponível (404)', async () => {
    instalarAprovacoes({
      aoDecidir: () => ({ status: 404, mensagem: 'Solicitação não encontrada.' }),
    })
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Licenças de software de design/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    await usuario.click(await within(dialog).findByRole('radio', { name: /1\.200,00/ }))
    await usuario.click(within(dialog).getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText('Solicitação não disponível para você.')).toBeInTheDocument()
  })

  it('gerente financeira vê as duas abas e o aviso DEC-019 na fila de setor', async () => {
    instalarAprovacoes()
    const usuario = userEvent.setup()
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/aprovacoes')

    expect(await screen.findByText('Curso online de certificação')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Aprovação financeira' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Aprovação de setor' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Aprovação de setor' }))
    expect(await screen.findByText('Você aprova o 1º nível apenas nos setores Oficina e TI.')).toBeInTheDocument()
    expect(screen.getByText('Licenças de software de design')).toBeInTheDocument()
    expect(screen.queryByText('Curso online de certificação')).not.toBeInTheDocument()
  })

  it('não oferece devolução para correção no nível financeiro', async () => {
    instalarAprovacoes()
    const usuario = userEvent.setup()
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/aprovacoes')

    const linha = await screen.findByRole('row', { name: /Curso online de certificação/ })
    await usuario.click(within(linha).getByRole('button', { name: 'Analisar' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('button', { name: 'Aprovar' })).toBeDisabled()
    expect(
      within(dialog).queryByRole('button', { name: 'Devolver para correção' }),
    ).not.toBeInTheDocument()
  })
})
