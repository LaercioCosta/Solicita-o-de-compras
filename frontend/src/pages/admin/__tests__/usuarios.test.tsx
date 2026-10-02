import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../test/server'
import { renderizarApp, semearSessao } from '../../../test/utils'
import { criarCenarioUsuarios, handlerEmailDuplicado, HASH_SENHA } from './fixtures'

describe('página de usuários do admin', () => {
  it('renderiza a lista sem expor senhaHash', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioUsuarios()
    server.use(...cenario.handlers)
    renderizarApp('/admin/usuarios')

    expect(await screen.findByText('Bruno Solicitante')).toBeInTheDocument()
    expect(screen.getByText('bruno@empresa.com')).toBeInTheDocument()
    expect(screen.getByText('Marcos Gerente')).toBeInTheDocument()
    expect(screen.getByText('Gerente')).toBeInTheDocument()
    expect(screen.getByText('Oficina')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('senhaHash')
    expect(document.body.textContent).not.toContain(HASH_SENHA)
  })

  it('cria um usuário válido com POST correto, toast e lista atualizada', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioUsuarios()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/usuarios')

    await screen.findByText('Bruno Solicitante')
    await usuario.click(screen.getByRole('button', { name: 'Novo usuário' }))
    await usuario.type(screen.getByLabelText('Nome'), 'Carla Nova')
    await usuario.type(screen.getByLabelText('E-mail'), 'carla@empresa.com')
    await usuario.type(screen.getByLabelText('Senha'), 'senha-segura-123')
    await usuario.selectOptions(screen.getByLabelText('Perfil'), 'FINANCEIRO')
    await usuario.selectOptions(screen.getByLabelText('Setor'), 'TI')
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }))

    expect(await screen.findByText('Usuário criado com sucesso.')).toBeInTheDocument()
    expect(cenario.corposPost).toEqual([
      {
        nome: 'Carla Nova',
        email: 'carla@empresa.com',
        senha: 'senha-segura-123',
        perfil: 'FINANCEIRO',
        setor: 'TI',
      },
    ])
    expect(await screen.findByText('Carla Nova')).toBeInTheDocument()
    expect(await screen.findByText('carla@empresa.com')).toBeInTheDocument()
  })

  it('bloqueia criação com senha curta no client-side', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioUsuarios()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/usuarios')

    await screen.findByText('Bruno Solicitante')
    await usuario.click(screen.getByRole('button', { name: 'Novo usuário' }))
    await usuario.type(screen.getByLabelText('Nome'), 'Carla Nova')
    await usuario.type(screen.getByLabelText('E-mail'), 'carla@empresa.com')
    await usuario.type(screen.getByLabelText('Senha'), '123')
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }))

    expect(
      await screen.findByText('A senha deve ter no mínimo 8 caracteres.'),
    ).toBeInTheDocument()
    expect(cenario.corposPost).toHaveLength(0)
  })

  it('exibe mensagem do backend ao receber 409 de e-mail duplicado', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioUsuarios()
    server.use(handlerEmailDuplicado(), ...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/usuarios')

    await screen.findByText('Bruno Solicitante')
    await usuario.click(screen.getByRole('button', { name: 'Novo usuário' }))
    await usuario.type(screen.getByLabelText('Nome'), 'Carla Nova')
    await usuario.type(screen.getByLabelText('E-mail'), 'bruno@empresa.com')
    await usuario.type(screen.getByLabelText('Senha'), 'senha-segura-123')
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }))

    expect(await screen.findByText('E-mail já cadastrado')).toBeInTheDocument()
  })

  it('edita usuário sem enviar o campo senha quando vazio', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioUsuarios()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/usuarios')

    await screen.findByText('Bruno Solicitante')
    await usuario.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    const campoNome = screen.getByLabelText('Nome')
    await usuario.clear(campoNome)
    await usuario.type(campoNome, 'Bruno da Silva')
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Usuário atualizado com sucesso.')).toBeInTheDocument()
    expect(cenario.corposPatch).toHaveLength(1)
    const { id, corpo } = cenario.corposPatch[0]
    expect(id).toBe(1)
    expect(Object.prototype.hasOwnProperty.call(corpo, 'senha')).toBe(false)
    expect(corpo.nome).toBe('Bruno da Silva')
    expect(corpo.email).toBe('bruno@empresa.com')
    expect(await screen.findByText('Bruno da Silva')).toBeInTheDocument()
  })

  it('filtra a lista por nome no client-side', async () => {
    semearSessao('ADMINISTRADOR')
    const cenario = criarCenarioUsuarios()
    server.use(...cenario.handlers)
    const usuario = userEvent.setup()
    renderizarApp('/admin/usuarios')

    await screen.findByText('Bruno Solicitante')
    await usuario.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'marcos')

    expect(await screen.findByText('Marcos Gerente')).toBeInTheDocument()
    const tabela = screen.getByRole('table')
    expect(within(tabela).queryByText('Bruno Solicitante')).not.toBeInTheDocument()
    expect(within(tabela).queryByText('Adriana Root')).not.toBeInTheDocument()
  })
})
