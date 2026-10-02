import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SolicitacaoDetalhe } from '../../types/api'
import { renderizarApp, semearSessao } from '../../test/utils'
import { server } from '../../test/server'
import {
  SOLICITACAO_CRIADA_ID,
  handlerCriarSolicitacao,
  handlerDetalheCriada,
} from './test-handlers'

const detalheCriada: SolicitacaoDetalhe = {
  id: SOLICITACAO_CRIADA_ID,
  descricao: 'Compra de teclados mecânicos',
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
}

describe('nova solicitação', () => {
  it('cria uma solicitação com itens e navega para o detalhe', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const corpos: unknown[] = []
    server.use(
      handlerCriarSolicitacao({ aoReceber: (corpo) => corpos.push(corpo) }),
      handlerDetalheCriada(detalheCriada),
    )
    renderizarApp('/solicitacoes/nova')

    await usuario.type(await screen.findByLabelText('Descrição'), 'Compra de teclados mecânicos')
    await usuario.type(screen.getByLabelText('Produto 1'), 'Teclado mecânico ABNT2')
    await usuario.type(screen.getByLabelText('Quantidade'), '2')
    await usuario.type(screen.getByLabelText('Valor unitário (R$)'), '150.50')
    await usuario.click(screen.getByRole('button', { name: 'Criar solicitação' }))

    expect(await screen.findByText('Solicitação criada com sucesso.')).toBeInTheDocument()
    expect(await screen.findByText(`Solicitação ${SOLICITACAO_CRIADA_ID}`)).toBeInTheDocument()
    expect(corpos).toEqual([
      {
        descricao: 'Compra de teclados mecânicos',
        itens: [{ produto: 'Teclado mecânico ABNT2', quantidade: 2, valorUnitarioEstimado: 150.5 }],
      },
    ])
  })

  it('bloqueia o envio com produto vazio e valor zero sem chamar a API', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const corpos: unknown[] = []
    server.use(handlerCriarSolicitacao({ aoReceber: (corpo) => corpos.push(corpo) }))
    renderizarApp('/solicitacoes/nova')

    await usuario.type(await screen.findByLabelText('Quantidade'), '2')
    await usuario.type(screen.getByLabelText('Valor unitário (R$)'), '0')
    await usuario.click(screen.getByRole('button', { name: 'Criar solicitação' }))

    expect(await screen.findByText('Informe a descrição.')).toBeInTheDocument()
    expect(screen.getByText('Informe o produto.')).toBeInTheDocument()
    expect(screen.getByText('O valor unitário deve ser maior que zero.')).toBeInTheDocument()
    expect(corpos).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Criar solicitação' })).toBeInTheDocument()
  })

  it('adiciona e remove itens dinamicamente antes de criar', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const corpos: unknown[] = []
    server.use(
      handlerCriarSolicitacao({ aoReceber: (corpo) => corpos.push(corpo) }),
      handlerDetalheCriada(detalheCriada),
    )
    renderizarApp('/solicitacoes/nova')

    await usuario.type(await screen.findByLabelText('Descrição'), 'Compra de periféricos')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar item' }))
    await usuario.type(screen.getByLabelText('Produto 2'), 'Mouse sem fio')
    await usuario.type(screen.getAllByLabelText('Quantidade')[1], '3')
    await usuario.type(screen.getAllByLabelText('Valor unitário (R$)')[1], '80')
    await usuario.click(screen.getByRole('button', { name: 'Remover item 1' }))
    await usuario.click(screen.getByRole('button', { name: 'Criar solicitação' }))

    expect(await screen.findByText('Solicitação criada com sucesso.')).toBeInTheDocument()
    expect(corpos).toEqual([
      {
        descricao: 'Compra de periféricos',
        itens: [{ produto: 'Mouse sem fio', quantidade: 3, valorUnitarioEstimado: 80 }],
      },
    ])
  })

  it('exibe mensagens do backend inline quando a criação retorna 400', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    server.use(
      handlerCriarSolicitacao({ status: 400, mensagem: 'A descrição deve conter mais detalhes.' }),
    )
    renderizarApp('/solicitacoes/nova')

    await usuario.type(await screen.findByLabelText('Descrição'), 'Compra de monitores')
    await usuario.type(screen.getByLabelText('Produto 1'), 'Monitor 27 polegadas')
    await usuario.type(screen.getByLabelText('Quantidade'), '1')
    await usuario.type(screen.getByLabelText('Valor unitário (R$)'), '1250')
    await usuario.click(screen.getByRole('button', { name: 'Criar solicitação' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('A descrição deve conter mais detalhes.')
    expect(screen.queryByText(`Solicitação ${SOLICITACAO_CRIADA_ID}`)).not.toBeInTheDocument()
  })
})
