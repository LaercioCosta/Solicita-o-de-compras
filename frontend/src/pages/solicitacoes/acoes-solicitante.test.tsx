import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthProvider'
import { ToasterProvider } from '../../components/ui/Toaster'
import type { Orcamento, SolicitacaoDetalhe } from '../../types/api'
import { renderizarApp, semearSessao } from '../../test/utils'
import { server } from '../../test/server'
import { AcoesSolicitante } from './components/AcoesSolicitante'
import {
  handlerAdicionarOrcamento,
  handlerCancelar,
  handlerEditarOrcamento,
  handlerEditarSolicitacao,
  handlerSubmeter,
} from './test-handlers'

function criarOrcamento(id: string, parcial: Partial<Orcamento> = {}): Orcamento {
  return {
    id,
    linkLoja: `https://loja-${id}.example.com/produto`,
    cnpjLoja: '12345678000199',
    valor: '250.00',
    validadeAte: null,
    createdAt: '2026-09-02T09:00:00.000Z',
    ...parcial,
  }
}

function criarSolicitacao(parcial: Partial<SolicitacaoDetalhe> = {}): SolicitacaoDetalhe {
  return {
    id: 's1',
    descricao: 'Compra de teclado mecânico',
    status: 'RASCUNHO',
    cicloAprovacao: 1,
    solicitanteId: 'u1',
    setorId: 'st1',
    motivoCancelamento: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    itens: [
      {
        id: 'i1',
        produto: 'Teclado mecânico ABNT2',
        quantidade: 2,
        valorUnitarioEstimado: '150.00',
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    ],
    orcamentos: [],
    _count: { orcamentos: 0, itens: 1 },
    ...parcial,
  }
}

type AoAtualizar = (solicitacao?: SolicitacaoDetalhe) => void

function renderizarPainel(solicitacao: SolicitacaoDetalhe, onAtualizar?: AoAtualizar) {
  return render(
    <MemoryRouter initialEntries={['/solicitacoes/s1']}>
      <AuthProvider>
        <ToasterProvider>
          <Routes>
            <Route path="/solicitacoes" element={<p>pagina-de-lista</p>} />
            <Route
              path="/solicitacoes/:id"
              element={
                <AcoesSolicitante solicitacao={solicitacao} onAtualizar={onAtualizar} />
              }
            />
          </Routes>
        </ToasterProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('painel de ações do solicitante', () => {
  it('não renderiza ações para usuários que não são o dono', () => {
    semearSessao('GERENTE')
    renderizarPainel(criarSolicitacao())
    expect(screen.queryByText('Ações do solicitante')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('permite adicionar um orçamento em rascunho', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const corpos: unknown[] = []
    server.use(handlerAdicionarOrcamento({ aoReceber: (corpo) => corpos.push(corpo) }))
    const onAtualizar = vi.fn()
    renderizarPainel(criarSolicitacao(), onAtualizar)

    await usuario.click(screen.getByRole('button', { name: 'Adicionar orçamento (0/3)' }))
    await usuario.type(screen.getByLabelText('Link da loja'), 'https://loja-nova.example.com/teclado')
    const campoCnpj = screen.getByLabelText('CNPJ da loja')
    fireEvent.change(campoCnpj, { target: { value: '12345678000199' } })
    expect(campoCnpj).toHaveValue('12.345.678/0001-99')
    await usuario.type(screen.getByLabelText('Valor (R$)'), '250.90')
    fireEvent.change(screen.getByLabelText('Validade (opcional)'), {
      target: { value: '2026-10-30' },
    })
    await usuario.click(screen.getByRole('button', { name: 'Adicionar orçamento' }))

    expect(await screen.findByText('Orçamento adicionado.')).toBeInTheDocument()
    expect(corpos).toEqual([
      {
        linkLoja: 'https://loja-nova.example.com/teclado',
        cnpjLoja: '12345678000199',
        valor: 250.9,
        validadeAte: '2026-10-30',
      },
    ])
    expect(onAtualizar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Adicionar orçamento' })).not.toBeInTheDocument()
  })

  it('bloqueia o quarto orçamento quando já existem três', () => {
    semearSessao('SOLICITANTE')
    const orcamentos = [criarOrcamento('o1'), criarOrcamento('o2'), criarOrcamento('o3')]
    renderizarPainel(criarSolicitacao({ orcamentos }))

    const botaoAdicionar = screen.getByRole('button', { name: 'Adicionar orçamento (3/3)' })
    expect(botaoAdicionar).toBeDisabled()
    expect(botaoAdicionar.closest('span')).toHaveAttribute(
      'title',
      'Limite de 3 orçamentos atingido.',
    )
  })

  it('desabilita submeter sem três orçamentos com tooltip explicativo', () => {
    semearSessao('SOLICITANTE')
    const orcamentos = [criarOrcamento('o1'), criarOrcamento('o2')]
    renderizarPainel(criarSolicitacao({ orcamentos }))

    const botaoSubmeter = screen.getByRole('button', { name: 'Submeter' })
    expect(botaoSubmeter).toBeDisabled()
    expect(botaoSubmeter.closest('span')).toHaveAttribute('title', 'exige 3 orçamentos')
    expect(screen.getByRole('button', { name: 'Adicionar orçamento (2/3)' })).toBeEnabled()
  })

  it('submete com sucesso quando há três orçamentos', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const chamadas: unknown[] = []
    server.use(handlerSubmeter({ aoReceber: (corpo) => chamadas.push(corpo) }))
    const onAtualizar = vi.fn()
    const orcamentos = [criarOrcamento('o1'), criarOrcamento('o2'), criarOrcamento('o3')]
    renderizarPainel(criarSolicitacao({ orcamentos }), onAtualizar)

    await usuario.click(screen.getByRole('button', { name: 'Submeter' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Solicitação enviada para aprovação.')).toBeInTheDocument()
    expect(chamadas).toHaveLength(1)
    expect(onAtualizar).toHaveBeenCalledTimes(1)
  })

  it('exibe toast de erro e não navega quando a submissão retorna 422', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    server.use(
      handlerSubmeter({ status: 422, mensagem: 'É necessário anexar exatamente 3 orçamentos.' }),
    )
    const orcamentos = [criarOrcamento('o1'), criarOrcamento('o2'), criarOrcamento('o3')]
    renderizarPainel(criarSolicitacao({ orcamentos }))

    await usuario.click(screen.getByRole('button', { name: 'Submeter' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('É necessário anexar exatamente 3 orçamentos.')).toBeInTheDocument()
    expect(screen.queryByText('pagina-de-lista')).not.toBeInTheDocument()
  })

  it('cancela a solicitação com motivo e volta para a lista', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const corpos: unknown[] = []
    server.use(handlerCancelar({ aoReceber: (corpo) => corpos.push(corpo) }))
    renderizarPainel(criarSolicitacao())

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    await usuario.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))
    expect(await screen.findByText('Informe o motivo do cancelamento.')).toBeInTheDocument()
    expect(corpos).toHaveLength(0)

    await usuario.type(screen.getByLabelText('Motivo do cancelamento'), 'Item comprado por outro setor')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }))

    expect(await screen.findByText('Solicitação cancelada.')).toBeInTheDocument()
    expect(await screen.findByText('pagina-de-lista')).toBeInTheDocument()
    expect(corpos).toEqual([{ motivo: 'Item comprado por outro setor' }])
  })

  it('edita descrição e itens em rascunho substituindo todos os itens', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const corpos: unknown[] = []
    const resposta = criarSolicitacao({ descricao: 'Compra de headsets' })
    server.use(
      handlerEditarSolicitacao({
        aoReceber: (corpo) => corpos.push(corpo),
        resposta,
      }),
    )
    const onAtualizar = vi.fn()
    renderizarPainel(criarSolicitacao(), onAtualizar)

    await usuario.click(screen.getByRole('button', { name: 'Editar' }))
    const campoDescricao = screen.getByLabelText('Descrição')
    await usuario.clear(campoDescricao)
    await usuario.type(campoDescricao, 'Compra de headsets')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Solicitação atualizada.')).toBeInTheDocument()
    expect(corpos).toEqual([
      {
        descricao: 'Compra de headsets',
        itens: [{ produto: 'Teclado mecânico ABNT2', quantidade: 2, valorUnitarioEstimado: 150 }],
      },
    ])
    expect(onAtualizar).toHaveBeenCalledWith(resposta)
  })

  it('reabre o ciclo de aprovação ao solicitar alteração em solicitação aprovada', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const solicitacao = criarSolicitacao({ status: 'APROVADO', cicloAprovacao: 1 })
    const corpos: unknown[] = []
    const resposta = { ...solicitacao, status: 'AGUARDANDO_APROVACAO_SETOR', cicloAprovacao: 2 }
    server.use(
      handlerEditarSolicitacao({
        aoReceber: (corpo) => corpos.push(corpo),
        resposta,
      }),
    )
    const onAtualizar = vi.fn()
    renderizarPainel(solicitacao, onAtualizar)

    expect(
      screen.getByText(/qualquer alteração reabre o ciclo de aprovação \(DEC-015\/DEC-027\)/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Solicitar alteração' }))
    const campoDescricao = screen.getByLabelText('Descrição')
    await usuario.clear(campoDescricao)
    await usuario.type(campoDescricao, 'Compra de dois monitores')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Alteração enviada para nova aprovação.')).toBeInTheDocument()
    expect(corpos).toEqual([
      {
        descricao: 'Compra de dois monitores',
        itens: [{ produto: 'Teclado mecânico ABNT2', quantidade: 2, valorUnitarioEstimado: 150 }],
      },
    ])
    expect(onAtualizar).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'AGUARDANDO_APROVACAO_SETOR', cicloAprovacao: 2 }),
    )
  })

  it('bloqueia qualquer ação após o início da compra (DEC-027)', () => {
    semearSessao('SOLICITANTE')
    renderizarPainel(criarSolicitacao({ status: 'COMPRA_EM_ANDAMENTO' }))

    expect(screen.getByText(/bloqueada para edição \(DEC-027\)/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('edita um orçamento existente em rascunho', async () => {
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    const orcamento = criarOrcamento('o1', {
      linkLoja: 'https://loja-a.example.com/teclado',
      valor: '250.00',
      validadeAte: '2026-10-30T12:00:00.000Z',
    })
    const corpos: unknown[] = []
    server.use(handlerEditarOrcamento({ aoReceber: (corpo) => corpos.push(corpo) }))
    renderizarPainel(criarSolicitacao({ orcamentos: [orcamento] }))

    await usuario.click(screen.getByRole('button', { name: 'Editar orçamento' }))
    expect(screen.getByLabelText('Link da loja')).toHaveValue('https://loja-a.example.com/teclado')
    expect(screen.getByLabelText('CNPJ da loja')).toHaveValue('12.345.678/0001-99')
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue(250)
    expect(screen.getByLabelText('Validade (opcional)')).toHaveValue('2026-10-30')
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '300.50' } })
    await usuario.click(screen.getByRole('button', { name: 'Salvar orçamento' }))

    expect(await screen.findByText('Orçamento atualizado.')).toBeInTheDocument()
    expect(corpos).toEqual([
      {
        linkLoja: 'https://loja-a.example.com/teclado',
        cnpjLoja: '12345678000199',
        valor: 300.5,
        validadeAte: '2026-10-30',
      },
    ])
  })

  it('oculta o painel quando não há usuário autenticado', () => {
    renderizarPainel(criarSolicitacao())
    expect(screen.queryByText('Ações do solicitante')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('integração da página de nova solicitação com o router', () => {
  it('exibe o formulário para o perfil solicitante', async () => {
    semearSessao('SOLICITANTE')
    renderizarApp('/solicitacoes/nova')

    expect(await screen.findByRole('heading', { name: 'Nova solicitação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar solicitação' })).toBeInTheDocument()
  })
})
