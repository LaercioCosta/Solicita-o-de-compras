import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../test/server'
import { renderizarApp, semearSessao } from '../../../test/utils'
import { criarCenarioSetores } from './fixtures'

describe('página de setores do admin', () => {
  it('atualiza o nome do setor via PATCH e exibe toast de sucesso', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioSetores()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/setores')

    expect(await screen.findByText('Oficina')).toBeInTheDocument()
    await usuario.click(screen.getAllByRole('button', { name: 'Editar nome' })[0])
    const campoNome = screen.getByLabelText('Nome')
    await usuario.clear(campoNome)
    await usuario.type(campoNome, 'Oficina Central')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Setor atualizado com sucesso.')).toBeInTheDocument()
    expect(cenario.corposPatch).toEqual([{ id: 1, corpo: { nome: 'Oficina Central' } }])
    expect(await screen.findByText('Oficina Central')).toBeInTheDocument()
  })

  it('cria um setor com slug do enum e atualiza a lista', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioSetores()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/setores')

    expect(await screen.findByText('Oficina')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Novo setor' }))
    await usuario.selectOptions(screen.getByLabelText('Slug'), 'COMERCIAL')
    await usuario.type(screen.getByLabelText('Nome'), 'Comercial')
    await usuario.click(screen.getByRole('button', { name: 'Criar setor' }))

    expect(await screen.findByText('Setor criado com sucesso.')).toBeInTheDocument()
    expect(cenario.corposPost).toEqual([{ slug: 'COMERCIAL', nome: 'Comercial' }])
    expect(await screen.findByText('COMERCIAL')).toBeInTheDocument()
  })

  it('exibe mensagem do backend ao receber 409 de slug duplicado', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioSetores()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/setores')

    expect(await screen.findByText('Oficina')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Novo setor' }))
    await usuario.selectOptions(screen.getByLabelText('Slug'), 'TI')
    await usuario.type(screen.getByLabelText('Nome'), 'TI Novo')
    await usuario.click(screen.getByRole('button', { name: 'Criar setor' }))

    expect(await screen.findByText('Slug de setor já cadastrado')).toBeInTheDocument()
  })
})
