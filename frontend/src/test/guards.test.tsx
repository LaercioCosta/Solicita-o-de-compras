import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderizarApp, semearSessao } from './utils'

describe('guards de rota e navegação por perfil', () => {
  it('redireciona para o login quando não há sessão', async () => {
    renderizarApp('/')

    await waitFor(() =>
      expect(screen.getByText('Entre com suas credenciais para acessar')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('bloqueia rota por perfil e redireciona ao dashboard', async () => {
    semearSessao('SOLICITANTE')
    renderizarApp('/aprovacoes')

    await waitFor(() => expect(screen.getByText('Rascunhos')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Aprovações' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pagamentos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
  })

  it('exibe itens de nav apenas para perfis autorizados', async () => {
    semearSessao('GERENTE')
    renderizarApp('/')

    await waitFor(() => expect(screen.getByRole('link', { name: 'Aprovações' })).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Nova solicitação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Notificações/ })).toBeInTheDocument()
  })
})
