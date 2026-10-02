// Permissões seguem default-deny: ausência de linha = proibido; apenas as células S da
// permission-matrix.md geram linhas (condições como "próprias"/"do próprio setor" serão
// aplicadas pelas policies do backend na Fase 4, não pela linha de permissão).
// E-mails *.local e a senha "SenhaDev123!" são dados de DEV, não secrets.

import { hash } from '@node-rs/argon2'
import type { PerfilUsuario, SetorSlug } from '../src/generated/prisma/enums.js'
import { createPrismaClient } from '../src/database/prisma.service.js'

const setores: ReadonlyArray<[SetorSlug, string]> = [
  ['OFICINA', 'Oficina'],
  ['TI', 'TI'],
  ['MKT', 'Marketing'],
  ['COMERCIAL', 'Comercial'],
]

const perfis: ReadonlyArray<[PerfilUsuario, string]> = [
  ['SOLICITANTE', 'Solicitante'],
  ['GERENTE', 'Gerente'],
  ['GERENTE_FINANCEIRA', 'Gerente Financeira'],
  ['FINANCEIRO', 'Financeiro'],
  ['TI', 'TI'],
  ['ADMINISTRADOR', 'Administrador'],
]

const permissoesPorPerfil: ReadonlyArray<[PerfilUsuario, ReadonlyArray<string>]> = [
  [
    'SOLICITANTE',
    [
      'solicitacao.criar',
      'solicitacao.visualizar',
      'solicitacao.editar',
      'solicitacao.cancelar',
      'orcamento.criar',
      'orcamento.visualizar',
      'orcamento.editar',
      'orcamento.anexar',
      'aprovacao.visualizar',
      'compra.visualizar',
      'pagamento.visualizar',
      'documento.criar',
      'documento.visualizar',
      'documento.editar',
      'documento.anexar',
    ],
  ],
  [
    'GERENTE',
    [
      'solicitacao.visualizar',
      'solicitacao.aprovar',
      'solicitacao.reprovar',
      'orcamento.visualizar',
      'aprovacao.visualizar',
      'aprovacao.aprovar',
      'aprovacao.registrar',
      'compra.visualizar',
      'pagamento.visualizar',
      'documento.visualizar',
    ],
  ],
  [
    'GERENTE_FINANCEIRA',
    [
      'solicitacao.visualizar',
      'solicitacao.aprovar',
      'solicitacao.reprovar',
      'orcamento.visualizar',
      'aprovacao.visualizar',
      'aprovacao.aprovar',
      'aprovacao.registrar',
      'compra.visualizar',
      'pagamento.visualizar',
      'pagamento.executar',
      'pagamento.anexar',
      'pagamento.registrar',
      'documento.visualizar',
      'documento.anexar',
    ],
  ],
  [
    'TI',
    [
      'solicitacao.visualizar',
      'orcamento.visualizar',
      'aprovacao.visualizar',
      'compra.visualizar',
      'compra.executar',
      'compra.registrar',
      'pagamento.visualizar',
      'pagamento.registrar',
      'documento.visualizar',
      'documento.anexar',
    ],
  ],
  [
    'FINANCEIRO',
    [
      'solicitacao.visualizar',
      'orcamento.visualizar',
      'aprovacao.visualizar',
      'compra.visualizar',
      'pagamento.visualizar',
      'pagamento.executar',
      'pagamento.anexar',
      'pagamento.registrar',
      'documento.visualizar',
      'documento.anexar',
    ],
  ],
  [
    'ADMINISTRADOR',
    [
      'auditoria.visualizar',
      'usuario.criar',
      'usuario.visualizar',
      'usuario.editar',
      'setor.criar',
      'setor.visualizar',
      'setor.editar',
    ],
  ],
]

const senhaDev = 'SenhaDev123!'

const usuarios: ReadonlyArray<{ nome: string; email: string; perfil: PerfilUsuario; setor: SetorSlug }> = [
  { nome: 'Ana Souza', email: 'ana.souza@compras.local', perfil: 'SOLICITANTE', setor: 'MKT' },
  { nome: 'Bruno Lima', email: 'bruno.lima@compras.local', perfil: 'GERENTE', setor: 'MKT' },
  { nome: 'Gabriela Norte', email: 'gabriela.norte@compras.local', perfil: 'GERENTE', setor: 'COMERCIAL' },
  { nome: 'Carla Mendes', email: 'carla.mendes@compras.local', perfil: 'GERENTE_FINANCEIRA', setor: 'MKT' },
  { nome: 'Davi Costa', email: 'davi.costa@compras.local', perfil: 'TI', setor: 'TI' },
  { nome: 'Elisa Rae', email: 'elisa.rae@compras.local', perfil: 'FINANCEIRO', setor: 'MKT' },
  { nome: 'Felipe Cruz', email: 'felipe.cruz@compras.local', perfil: 'ADMINISTRADOR', setor: 'TI' },
]

const prisma = createPrismaClient()

async function seed(): Promise<void> {
  for (const [slug, nome] of setores) {
    await prisma.setor.upsert({
      where: { slug },
      update: { nome },
      create: { slug, nome },
    })
  }

  for (const [slug, nome] of perfis) {
    await prisma.perfil.upsert({
      where: { slug },
      update: { nome },
      create: { slug, nome },
    })
  }

  for (const [slugPerfil, codigos] of permissoesPorPerfil) {
    const perfil = await prisma.perfil.findUniqueOrThrow({ where: { slug: slugPerfil } })
    for (const codigo of codigos) {
      const [entidade, acao] = codigo.split('.')
      await prisma.permissao.upsert({
        where: { perfilId_entidade_acao: { perfilId: perfil.id, entidade, acao } },
        update: { permitida: true },
        create: { perfilId: perfil.id, entidade, acao, permitida: true },
      })
    }
  }

  const senhaHash = await hash(senhaDev)
  for (const { nome, email, perfil, setor } of usuarios) {
    await prisma.usuario.upsert({
      where: { email },
      update: { nome, senhaHash, perfil: { connect: { slug: perfil } }, setor: { connect: { slug: setor } } },
      create: { nome, email, senhaHash, perfil: { connect: { slug: perfil } }, setor: { connect: { slug: setor } } },
    })
  }
}

try {
  await seed()
} finally {
  await prisma.$disconnect()
}
