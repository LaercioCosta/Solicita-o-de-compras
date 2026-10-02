import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderizarApp } from './utils'

describe('login', () => {
  it('autentica um gerente e exibe os cards do dashboard', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/login')

    await usuario.type(await screen.findByLabelText('E-mail'), 'gerente@empresa.com')
    await usuario.type(screen.getByLabelText('Senha'), 'senha123')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Pendências de aprovação')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    expect(screen.getByText('Marta Lima')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aprovações' })).toBeInTheDocument()
  })

  it('exibe mensagem de erro clara quando as credenciais são inválidas', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/login')

    await usuario.type(await screen.findByLabelText('E-mail'), 'gerente@empresa.com')
    await usuario.type(screen.getByLabelText('Senha'), 'senha-errada')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.'))
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
  })

  it('exibe erros de validação quando o formulário é enviado vazio', async () => {
    const usuario = userEvent.setup()
    renderizarApp('/login')

    await usuario.click(await screen.findByRole('button', { name: 'Entrar' }))

    expect(screen.getByText('Informe o e-mail')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha')).toBeInTheDocument()
  })
})
