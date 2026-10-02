import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../test/server'
import { renderizarApp, semearSessao } from '../../../test/utils'
import { criarCenarioAuditoria } from './fixtures'

describe('página de auditoria do admin', () => {
  it('aplica filtros gerando a query correta e renderiza registros com usuário', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioAuditoria()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/auditoria')

    expect(await screen.findByText('Marcos Gerente')).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Entidade'), 'solicitacao')
    await usuario.type(screen.getByLabelText('ID da entidade'), '1')
    await usuario.selectOptions(screen.getByLabelText('Ação'), 'APROVAR')
    await usuario.selectOptions(screen.getByLabelText('Novo estado'), 'APROVADO')
    await usuario.selectOptions(screen.getByLabelText('Registros por página'), '10')
    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }))

    const url = new URL(cenario.urls.at(-1) ?? '')
    expect(url.searchParams.get('entidade')).toBe('solicitacao')
    expect(url.searchParams.get('entidadeId')).toBe('1')
    expect(url.searchParams.get('acao')).toBe('APROVAR')
    expect(url.searchParams.get('estadoNovo')).toBe('APROVADO')
    expect(url.searchParams.get('limit')).toBe('10')
    expect(url.searchParams.get('offset')).toBe('0')

    expect(await screen.findByText('Marcos Gerente')).toBeInTheDocument()
    expect(screen.getByText('gerente@empresa.com')).toBeInTheDocument()
    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('Aprovar')).toBeInTheDocument()
    expect(within(tabela).getByText('Solicitação #1')).toBeInTheDocument()
    expect(within(tabela).getByText('Aguardando aprovação do setor')).toBeInTheDocument()
    expect(within(tabela).getByText('Aprovado')).toBeInTheDocument()
    expect(document.body.textContent).toContain('camposAlterados')
  })

  it('exibe EmptyState quando não há registros', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioAuditoria()
    cenario.definirResposta([])
    server.use(...cenario.handlers)
    renderizarApp('/admin/auditoria')

    expect(await screen.findByText('Nenhum registro de auditoria')).toBeInTheDocument()
    expect(
      screen.getByText('Nenhuma ação encontrada com os filtros atuais.'),
    ).toBeInTheDocument()
  })

  it('não exibe nenhum botão de edição ou exclusão (somente leitura)', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioAuditoria()
    server.use(...cenario.handlers)
    renderizarApp('/admin/auditoria')

    expect(await screen.findByText('Marcos Gerente')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /editar|excluir|remover|alterar|salvar|criar|novo|exibir/i,
      }),
    ).not.toBeInTheDocument()
  })
})
