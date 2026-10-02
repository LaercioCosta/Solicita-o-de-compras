import { HttpResponse, http } from 'msw'
import { autorizado, respostaNaoAutorizada } from '../../../test/handlers'
import type { Perfil } from '../../../types/api'
import type { RegistroAuditoria, SetorAdmin, SlugSetor, UsuarioAdmin } from '../tipos'

export const HASH_SENHA = '$argon2id$v=19$m=65536,t=3,p=4$c2VuaGFTZWNyZXRh$hashFalso'

export const PERFIS_FIXOS: Record<Perfil, { id: number; slug: Perfil; nome: string }> = {
  SOLICITANTE: { id: 1, slug: 'SOLICITANTE', nome: 'Solicitante' },
  GERENTE: { id: 2, slug: 'GERENTE', nome: 'Gerente' },
  GERENTE_FINANCEIRA: { id: 3, slug: 'GERENTE_FINANCEIRA', nome: 'Gerente Financeira' },
  FINANCEIRO: { id: 4, slug: 'FINANCEIRO', nome: 'Financeiro' },
  TI: { id: 5, slug: 'TI', nome: 'TI' },
  ADMINISTRADOR: { id: 6, slug: 'ADMINISTRADOR', nome: 'Administrador' },
}

export const SETORES_ADMIN: Record<SlugSetor, SetorAdmin> = {
  OFICINA: {
    id: 1,
    slug: 'OFICINA',
    nome: 'Oficina',
    descricao: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  TI: {
    id: 2,
    slug: 'TI',
    nome: 'TI',
    descricao: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  MKT: {
    id: 3,
    slug: 'MKT',
    nome: 'Marketing',
    descricao: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  COMERCIAL: {
    id: 4,
    slug: 'COMERCIAL',
    nome: 'Comercial',
    descricao: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
}

function criarUsuarios(): UsuarioAdmin[] {
  return [
    {
      id: 1,
      nome: 'Bruno Solicitante',
      email: 'bruno@empresa.com',
      perfilId: 1,
      setorId: 1,
      createdAt: '2026-08-05T09:00:00.000Z',
      updatedAt: '2026-08-05T09:00:00.000Z',
      perfil: PERFIS_FIXOS.SOLICITANTE,
      setor: SETORES_ADMIN.OFICINA,
    },
    {
      id: 2,
      nome: 'Marcos Gerente',
      email: 'gerente@empresa.com',
      perfilId: 2,
      setorId: 2,
      createdAt: '2026-08-06T09:00:00.000Z',
      updatedAt: '2026-08-06T09:00:00.000Z',
      perfil: PERFIS_FIXOS.GERENTE,
      setor: SETORES_ADMIN.TI,
    },
    {
      id: 3,
      nome: 'Adriana Root',
      email: 'admin@empresa.com',
      perfilId: 6,
      setorId: 3,
      createdAt: '2026-08-07T09:00:00.000Z',
      updatedAt: '2026-08-07T09:00:00.000Z',
      perfil: PERFIS_FIXOS.ADMINISTRADOR,
      setor: SETORES_ADMIN.MKT,
    },
  ]
}

export interface CenarioUsuarios {
  handlers: ReturnType<typeof http.get>[]
  corposPost: Record<string, unknown>[]
  corposPatch: { id: number; corpo: Record<string, unknown> }[]
  usuarios: UsuarioAdmin[]
}

export function criarCenarioUsuarios(): CenarioUsuarios {
  const usuarios = criarUsuarios()
  const corposPost: Record<string, unknown>[] = []
  const corposPatch: { id: number; corpo: Record<string, unknown> }[] = []

  const handlers = [
    http.get('/api/usuarios', ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      return HttpResponse.json(usuarios.map((usuario) => ({ ...usuario, senhaHash: HASH_SENHA })))
    }),
    http.post('/api/usuarios', async ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as Record<string, unknown>
      corposPost.push(corpo)
      const perfil = PERFIS_FIXOS[corpo.perfil as Perfil]
      const setor = SETORES_ADMIN[corpo.setor as SlugSetor]
      const novo: UsuarioAdmin = {
        id: usuarios.length + 1,
        nome: corpo.nome as string,
        email: corpo.email as string,
        perfilId: perfil.id,
        setorId: setor.id,
        createdAt: '2026-09-25T12:00:00.000Z',
        updatedAt: '2026-09-25T12:00:00.000Z',
        perfil,
        setor,
      }
      usuarios.push(novo)
      return HttpResponse.json(novo, { status: 201 })
    }),
    http.patch('/api/usuarios/:id', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as Record<string, unknown>
      const id = Number(params.id)
      corposPatch.push({ id, corpo })
      const indice = usuarios.findIndex((usuario) => usuario.id === id)
      if (indice === -1) {
        return HttpResponse.json({ message: 'Usuário não encontrado', statusCode: 404 }, { status: 404 })
      }
      const atual = usuarios[indice]
      const atualizado: UsuarioAdmin = {
        ...atual,
        nome: (corpo.nome as string) ?? atual.nome,
        email: (corpo.email as string) ?? atual.email,
        perfil: corpo.perfil ? PERFIS_FIXOS[corpo.perfil as Perfil] : atual.perfil,
        setor: corpo.setor ? SETORES_ADMIN[corpo.setor as SlugSetor] : atual.setor,
      }
      usuarios[indice] = atualizado
      return HttpResponse.json(atualizado)
    }),
  ]

  return { handlers, corposPost, corposPatch, usuarios }
}

export function handlerEmailDuplicado() {
  return http.post('/api/usuarios', () =>
    HttpResponse.json({ message: 'E-mail já cadastrado', statusCode: 409 }, { status: 409 }),
  )
}

export interface CenarioSetores {
  handlers: ReturnType<typeof http.get>[]
  corposPost: Record<string, unknown>[]
  corposPatch: { id: number; corpo: Record<string, unknown> }[]
  setores: SetorAdmin[]
}

export function criarCenarioSetores(): CenarioSetores {
  const setores: SetorAdmin[] = [
    SETORES_ADMIN.OFICINA,
    SETORES_ADMIN.TI,
    SETORES_ADMIN.MKT,
  ]
  const corposPost: Record<string, unknown>[] = []
  const corposPatch: { id: number; corpo: Record<string, unknown> }[] = []

  const handlers = [
    http.get('/api/setores', ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      return HttpResponse.json(setores)
    }),
    http.post('/api/setores', async ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as Record<string, unknown>
      corposPost.push(corpo)
      if (setores.some((setor) => setor.slug === corpo.slug)) {
        return HttpResponse.json(
          { message: 'Slug de setor já cadastrado', statusCode: 409 },
          { status: 409 },
        )
      }
      const novo: SetorAdmin = {
        id: setores.length + 1,
        slug: corpo.slug as SlugSetor,
        nome: corpo.nome as string,
        descricao: null,
        createdAt: '2026-09-25T12:00:00.000Z',
        updatedAt: '2026-09-25T12:00:00.000Z',
      }
      setores.push(novo)
      return HttpResponse.json(novo, { status: 201 })
    }),
    http.patch('/api/setores/:id', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const corpo = (await request.json()) as Record<string, unknown>
      const id = Number(params.id)
      corposPatch.push({ id, corpo })
      const indice = setores.findIndex((setor) => setor.id === id)
      if (indice === -1) {
        return HttpResponse.json({ message: 'Setor não encontrado', statusCode: 404 }, { status: 404 })
      }
      setores[indice] = { ...setores[indice], nome: (corpo.nome as string) ?? setores[indice].nome }
      return HttpResponse.json(setores[indice])
    }),
  ]

  return { handlers, corposPost, corposPatch, setores }
}

export const REGISTROS_AUDITORIA: RegistroAuditoria[] = [
  {
    id: 101,
    usuarioId: 2,
    perfil: 'GERENTE',
    acao: 'APROVAR',
    entidade: 'solicitacao',
    entidadeId: 1,
    estadoAnterior: 'AGUARDANDO_APROVACAO_SETOR',
    estadoNovo: 'APROVADO',
    dados: { camposAlterados: ['status'] },
    createdAt: '2026-09-20T14:30:00.000Z',
    usuario: { nome: 'Marcos Gerente', email: 'gerente@empresa.com' },
  },
  {
    id: 102,
    usuarioId: 6,
    perfil: 'ADMINISTRADOR',
    acao: 'CRIAR',
    entidade: 'usuario',
    entidadeId: 9,
    estadoAnterior: null,
    estadoNovo: null,
    dados: null,
    createdAt: '2026-09-21T09:15:00.000Z',
    usuario: { nome: 'Adriana Root', email: 'admin@empresa.com' },
  },
]

export interface CenarioAuditoria {
  handlers: ReturnType<typeof http.get>[]
  urls: string[]
  definirResposta: (registros: RegistroAuditoria[]) => void
}

export function criarCenarioAuditoria(): CenarioAuditoria {
  const urls: string[] = []
  let resposta: RegistroAuditoria[] = REGISTROS_AUDITORIA

  const handlers = [
    http.get('/api/auditoria', ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      urls.push(request.url)
      return HttpResponse.json(resposta)
    }),
  ]

  return {
    handlers,
    urls,
    definirResposta: (registros) => {
      resposta = registros
    },
  }
}
