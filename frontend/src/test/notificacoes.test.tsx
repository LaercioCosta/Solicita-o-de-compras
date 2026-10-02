import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderizarApp, semearSessao } from './utils'

describe('notificações', () => {
  it('conta não lidas no badge e marca como lida ao clicar', async () => {
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/notificacoes')

    await waitFor(() => expect(screen.getByTestId('badge-notificacoes')).toHaveTextContent('2'))

    const botoes = await screen.findAllByRole('button', { name: 'Marcar como lida' })
    expect(botoes.length).toBe(2)
    expect(screen.getByText('Solicitação s3 aguarda aprovação do setor.')).toBeInTheDocument()

    await usuario.click(botoes[0])

    await waitFor(() => expect(screen.getByTestId('badge-notificacoes')).toHaveTextContent('1'))
    expect(await screen.findByRole('button', { name: 'Marcar como lida' })).toBeInTheDocument()
  })
})
