import { http, HttpResponse } from 'msw'
import type {
  Notificacao,
  Perfil,
  SolicitacaoDetalhe,
  SolicitacaoResumo,
  Usuario,
} from '../types/api'

export const SENHA_VALIDA = 'senha123'

export const USUARIOS_POR_EMAIL: Record<string, Usuario> = {
  'solicitante@empresa.com': {
    id: 'u1',
    nome: 'João Souza',
    email: 'solicitante@empresa.com',
    perfil: 'SOLICITANTE',
    setorId: 'st1',
  },
  'gerente@empresa.com': {
    id: 'u2',
    nome: 'Marta Lima',
    email: 'gerente@empresa.com',
    perfil: 'GERENTE',
    setorId: 'st1',
  },
  'gf@empresa.com': {
    id: 'u3',
    nome: 'Rita Alves',
    email: 'gf@empresa.com',
    perfil: 'GERENTE_FINANCEIRA',
    setorId: 'st2',
  },
  'financeiro@empresa.com': {
    id: 'u5',
    nome: 'Paulo Rei',
    email: 'financeiro@empresa.com',
    perfil: 'FINANCEIRO',
    setorId: 'st2',
  },
  'ti@empresa.com': {
    id: 'u4',
    nome: 'Tec Infra',
    email: 'ti@empresa.com',
    perfil: 'TI',
    setorId: 'st3',
  },
  'admin@empresa.com': {
    id: 'u6',
    nome: 'Adriana Root',
    email: 'admin@empresa.com',
    perfil: 'ADMINISTRADOR',
    setorId: 'st4',
  },
}

export const EMAILS: Record<Perfil, string> = {
  SOLICITANTE: 'solicitante@empresa.com',
  GERENTE: 'gerente@empresa.com',
  GERENTE_FINANCEIRA: 'gf@empresa.com',
  FINANCEIRO: 'financeiro@empresa.com',
  TI: 'ti@empresa.com',
  ADMINISTRADOR: 'admin@empresa.com',
}

export const TOKENS_ACEITOS = new Set(['access-token-1', 'access-token-2'])

function criarSolicitacoes(): SolicitacaoResumo[] {
  const base = {
    solicitanteId: 'u1',
    setorId: 'st1',
    motivoCancelamento: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-10T14:30:00.000Z',
  }
  return [
    { id: 's1', descricao: 'Compra de notebooks novos', status: 'COMPRA_EM_ANDAMENTO', cicloAprovacao: 2, _count: { orcamentos: 3, itens: 2 }, ...base },
    { id: 's2', descricao: 'Reposição de material de escritório', status: 'RASCUNHO', cicloAprovacao: 1, _count: { orcamentos: 0, itens: 1 }, ...base },
    { id: 's3', descricao: 'Licenças de software de design', status: 'AGUARDANDO_APROVACAO_SETOR', cicloAprovacao: 1, _count: { orcamentos: 3, itens: 1 }, ...base },
    { id: 's4', descricao: 'Cadeiras ergonômicas para o time', status: 'AGUARDANDO_APROVACAO_SETOR', cicloAprovacao: 1, _count: { orcamentos: 3, itens: 1 }, ...base },
    { id: 's5', descricao: 'Monitor 27 para estação de trabalho', status: 'AGUARDANDO_APROVACAO_SETOR', cicloAprovacao: 1, _count: { orcamentos: 2, itens: 1 }, ...base },
    { id: 's6', descricao: 'Teclado mecânico para teste', status: 'CONCLUIDO', cicloAprovacao: 1, _count: { orcamentos: 3, itens: 1 }, ...base },
    { id: 's7', descricao: 'Curso online de certificação', status: 'AGUARDANDO_APROVACAO_FINANCEIRA', cicloAprovacao: 1, _count: { orcamentos: 3, itens: 1 }, ...base },
    { id: 's8', descricao: 'Servidores para infraestrutura', status: 'AGUARDANDO_TI', cicloAprovacao: 1, _count: { orcamentos: 3, itens: 1 }, ...base },
    { id: 's9', descricao: 'Notebook dedicado ao financeiro', status: 'AGUARDANDO_FINANCEIRO', cicloAprovacao: 1, _count: { orcamentos: 3, itens: 1 }, ...base },
    { id: 's10', descricao: 'Mesa de reunião nova', status: 'AGUARDANDO_CORRECAO', cicloAprovacao: 1, _count: { orcamentos: 3, itens: 1 }, ...base },
  ]
}

function criarNotificacoes(): Notificacao[] {
  return [
    {
      id: 'n1',
      mensagem: 'Solicitação s3 aguarda aprovação do setor.',
      lida: false,
      lidaEm: null,
      createdAt: '2026-09-20T10:00:00.000Z',
      solicitacaoId: 's3',
    },
    {
      id: 'n2',
      mensagem: 'Solicitação s1 está em compra em andamento.',
      lida: false,
      lidaEm: null,
      createdAt: '2026-09-21T10:00:00.000Z',
      solicitacaoId: 's1',
    },
    {
      id: 'n3',
      mensagem: 'Solicitação s6 foi concluída.',
      lida: true,
      lidaEm: '2026-09-22T10:00:00.000Z',
      createdAt: '2026-09-19T10:00:00.000Z',
      solicitacaoId: 's6',
    },
  ]
}

let solicitacoes = criarSolicitacoes()
let notificacoes = criarNotificacoes()

export function reiniciarFixtures(): void {
  solicitacoes = criarSolicitacoes()
  notificacoes = criarNotificacoes()
}

export function solicitacoesAtuais(): SolicitacaoResumo[] {
  return solicitacoes
}

export function autorizado(request: Request): boolean {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '')
  return TOKENS_ACEITOS.has(token)
}

export function respostaNaoAutorizada() {
  return HttpResponse.json({ message: 'Não autorizado.', statusCode: 401 }, { status: 401 })
}

export function listaSolicitacoesFiltrada(url: URL): SolicitacaoResumo[] {
  const status = url.searchParams.get('status')
  const limit = Number(url.searchParams.get('limit') ?? '100')
  const offset = Number(url.searchParams.get('offset') ?? '0')
  const base = status ? solicitacoes.filter((item) => item.status === status) : solicitacoes
  return base.slice(offset, offset + limit)
}

export const detalheSolicitacao: SolicitacaoDetalhe = {
  id: 's1',
  descricao: 'Compra de notebooks novos',
  status: 'COMPRA_EM_ANDAMENTO',
  cicloAprovacao: 2,
  solicitanteId: 'u1',
  setorId: 'st1',
  motivoCancelamento: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-10T14:30:00.000Z',
  itens: [
    {
      id: 'i1',
      produto: 'Notebook Dell Latitude 5540',
      quantidade: 2,
      valorUnitarioEstimado: '4899.90',
      createdAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'i2',
      produto: 'Monitor Dell 27 polegadas',
      quantidade: 2,
      valorUnitarioEstimado: '1250.00',
      createdAt: '2026-09-01T10:00:00.000Z',
    },
  ],
  orcamentos: [
    {
      id: 'o1',
      linkLoja: 'https://loja-a.example.com/notebooks',
      cnpjLoja: '12345678000199',
      valor: '12345.60',
      validadeAte: '2026-10-30T12:00:00.000Z',
      createdAt: '2026-09-02T09:00:00.000Z',
    },
    {
      id: 'o2',
      linkLoja: 'https://loja-b.example.com/notebooks',
      cnpjLoja: '98765432000110',
      valor: '9800.00',
      validadeAte: null,
      createdAt: '2026-09-02T09:10:00.000Z',
    },
  ],
  _count: { orcamentos: 2, itens: 2 },
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const corpo = (await request.json()) as { email?: string; senha?: string }
    const usuario = corpo.email ? USUARIOS_POR_EMAIL[corpo.email] : undefined
    if (!usuario || corpo.senha !== SENHA_VALIDA) {
      return HttpResponse.json({ message: 'E-mail ou senha inválidos.', statusCode: 401 }, { status: 401 })
    }
    return HttpResponse.json({ accessToken: 'access-token-1', refreshToken: 'refresh-token-1', usuario })
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const corpo = (await request.json()) as { refreshToken?: string }
    if (corpo.refreshToken !== 'refresh-token-1') {
      return HttpResponse.json(
        { message: 'Refresh token inválido ou revogado.', statusCode: 401 },
        { status: 401 },
      )
    }
    return HttpResponse.json({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' })
  }),

  http.post('/api/auth/logout', () => HttpResponse.json({})),

  http.get('/api/solicitacoes', ({ request }) => {
    if (!autorizado(request)) {
      return respostaNaoAutorizada()
    }
    return HttpResponse.json(listaSolicitacoesFiltrada(new URL(request.url)))
  }),

  http.get('/api/solicitacoes/:id', ({ request, params }) => {
    if (!autorizado(request)) {
      return respostaNaoAutorizada()
    }
    if (params.id !== detalheSolicitacao.id) {
      return HttpResponse.json(
        { message: 'Solicitação não encontrada.', statusCode: 404 },
        { status: 404 },
      )
    }
    return HttpResponse.json(detalheSolicitacao)
  }),

  http.get('/api/notificacoes', ({ request }) => {
    if (!autorizado(request)) {
      return respostaNaoAutorizada()
    }
    return HttpResponse.json(notificacoes)
  }),

  http.post('/api/notificacoes/:id/lida', ({ request, params }) => {
    if (!autorizado(request)) {
      return respostaNaoAutorizada()
    }
    const indice = notificacoes.findIndex((notificacao) => notificacao.id === params.id)
    if (indice === -1) {
      return HttpResponse.json(
        { message: 'Notificação não encontrada.', statusCode: 404 },
        { status: 404 },
      )
    }
    const atualizada: Notificacao = {
      ...notificacoes[indice],
      lida: true,
      lidaEm: '2026-09-25T12:00:00.000Z',
    }
    notificacoes[indice] = atualizada
    return HttpResponse.json(atualizada)
  }),

  http.get('/api/documentos/:id/download', ({ request }) => {
    if (!autorizado(request)) {
      return respostaNaoAutorizada()
    }
    return new HttpResponse('conteudo-do-arquivo', {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="orcamento.pdf"',
      },
    })
  }),
]
