import { Prisma, type EstadoSolicitacao, type PrismaClient } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../src/database/prisma.service.js';

const PREFIXO_EMAIL = 'db-integrity-spec';

let prisma: PrismaClient;
let perfilId: number;
let setorId: number;

interface Dados {
  userIds: number[];
  solicitacaoIds: number[];
  orcamentoIds: number[];
}

async function limpar(dados: Dados): Promise<void> {
  await prisma.aprovacao.deleteMany({ where: { solicitacaoId: { in: dados.solicitacaoIds } } });
  await prisma.compra.deleteMany({ where: { solicitacaoId: { in: dados.solicitacaoIds } } });
  await prisma.orcamento.deleteMany({ where: { solicitacaoId: { in: dados.solicitacaoIds } } });
  await prisma.solicitacao.deleteMany({ where: { id: { in: dados.solicitacaoIds } } });
  await prisma.usuario.deleteMany({ where: { id: { in: dados.userIds } } });
}

async function criarUsuario(dados: Dados, email: string) {
  const usuario = await prisma.usuario.create({
    data: { nome: `Usuario ${email}`, email, senhaHash: 'hash-teste', perfilId, setorId },
  });
  dados.userIds.push(usuario.id);
  return usuario;
}

async function criarSolicitacao(dados: Dados, solicitanteId: number, status: EstadoSolicitacao) {
  const solicitacao = await prisma.solicitacao.create({
    data: { descricao: `${PREFIXO_EMAIL} ${solicitanteId}`, status, solicitanteId, setorId },
  });
  dados.solicitacaoIds.push(solicitacao.id);
  return solicitacao;
}

async function criarOrcamento(dados: Dados, solicitacaoId: number) {
  const orcamento = await prisma.orcamento.create({
    data: {
      solicitacaoId,
      linkLoja: `https://exemplo.test/orcamento-${solicitacaoId}`,
      cnpjLoja: '00000000000191',
      valor: 100.5,
    },
  });
  dados.orcamentoIds.push(orcamento.id);
  return orcamento;
}

describe('Integridade do banco (Fase 3)', () => {
  beforeAll(async () => {
    prisma = createPrismaClient();
    const [perfil, setor] = await Promise.all([
      prisma.perfil.findUniqueOrThrow({ where: { slug: 'SOLICITANTE' } }),
      prisma.setor.findFirstOrThrow(),
    ]);
    perfilId = perfil.id;
    setorId = setor.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    const usuarios = await prisma.usuario.findMany({
      where: { email: { startsWith: PREFIXO_EMAIL } },
      select: { id: true },
    });
    const ids = usuarios.map((u) => u.id);
    await prisma.aprovacao.deleteMany({ where: { aprovadorId: { in: ids } } });
    await prisma.compra.deleteMany({ where: { executanteId: { in: ids } } });
    await prisma.orcamento.deleteMany({ where: { solicitacao: { solicitanteId: { in: ids } } } });
    await prisma.solicitacao.deleteMany({ where: { solicitanteId: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('DEC-022: 2ª aprovação com mesmo (solicitacaoId, cicloAprovacao, nivel) é rejeitada com P2002 e mesmo nível em ciclo diferente é permitido', async () => {
    const dados: Dados = { userIds: [], solicitacaoIds: [], orcamentoIds: [] };
    try {
      const aprovador = await criarUsuario(dados, `${PREFIXO_EMAIL}-dec022@test.local`);
      const solicitacao = await criarSolicitacao(dados, aprovador.id, 'AGUARDANDO_APROVACAO_SETOR');
      const orcamento = await criarOrcamento(dados, solicitacao.id);

      const primeira = await prisma.aprovacao.create({
        data: {
          solicitacaoId: solicitacao.id,
          orcamentoId: orcamento.id,
          aprovadorId: aprovador.id,
          nivel: 'SETOR',
          decisao: 'APROVADO',
          cicloAprovacao: 1,
        },
      });
      expect(primeira.cicloAprovacao).toBe(1);
      expect(primeira.nivel).toBe('SETOR');

      await expect(
        prisma.aprovacao.create({
          data: {
            solicitacaoId: solicitacao.id,
            orcamentoId: orcamento.id,
            aprovadorId: aprovador.id,
            nivel: 'SETOR',
            decisao: 'APROVADO',
            cicloAprovacao: 1,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const segunda = await prisma.aprovacao.create({
        data: {
          solicitacaoId: solicitacao.id,
          orcamentoId: orcamento.id,
          aprovadorId: aprovador.id,
          nivel: 'SETOR',
          decisao: 'REPROVADO',
          cicloAprovacao: 2,
        },
      });
      expect(segunda.cicloAprovacao).toBe(2);

      const aprovacoes = await prisma.aprovacao.findMany({ where: { solicitacaoId: solicitacao.id } });
      expect(aprovacoes).toHaveLength(2);
    } finally {
      await limpar(dados);
    }
  });

  it('RN-06: aprovação com orcamentoId inexistente é rejeitada com P2003 (vínculo obrigatório ao orçamento)', async () => {
    const dados: Dados = { userIds: [], solicitacaoIds: [], orcamentoIds: [] };
    try {
      const aprovador = await criarUsuario(dados, `${PREFIXO_EMAIL}-rn06@test.local`);
      const solicitacao = await criarSolicitacao(dados, aprovador.id, 'AGUARDANDO_APROVACAO_SETOR');

      await expect(
        prisma.aprovacao.create({
          data: {
            solicitacaoId: solicitacao.id,
            orcamentoId: 999999999,
            aprovadorId: aprovador.id,
            nivel: 'SETOR',
            decisao: 'APROVADO',
            cicloAprovacao: 1,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      const aprovacoes = await prisma.aprovacao.findMany({ where: { solicitacaoId: solicitacao.id } });
      expect(aprovacoes).toHaveLength(0);
    } finally {
      await limpar(dados);
    }
  });

  it('onDelete Restrict: delete de usuário com solicitação, de solicitação com orçamento e de orçamento com aprovação é rejeitado com P2003', async () => {
    const dados: Dados = { userIds: [], solicitacaoIds: [], orcamentoIds: [] };
    try {
      const solicitante = await criarUsuario(dados, `${PREFIXO_EMAIL}-restrict-solicitante@test.local`);
      const aprovador = await criarUsuario(dados, `${PREFIXO_EMAIL}-restrict-aprovador@test.local`);
      const solicitacao = await criarSolicitacao(dados, solicitante.id, 'AGUARDANDO_APROVACAO_SETOR');
      const orcamento = await criarOrcamento(dados, solicitacao.id);
      await prisma.aprovacao.create({
        data: {
          solicitacaoId: solicitacao.id,
          orcamentoId: orcamento.id,
          aprovadorId: aprovador.id,
          nivel: 'SETOR',
          decisao: 'APROVADO',
          cicloAprovacao: 1,
        },
      });

      await expect(prisma.usuario.delete({ where: { id: solicitante.id } })).rejects.toMatchObject({
        code: 'P2003',
      });
      await expect(prisma.solicitacao.delete({ where: { id: solicitacao.id } })).rejects.toMatchObject({
        code: 'P2003',
      });
      await expect(prisma.orcamento.delete({ where: { id: orcamento.id } })).rejects.toMatchObject({
        code: 'P2003',
      });

      expect(await prisma.usuario.count({ where: { id: solicitante.id } })).toBe(1);
      expect(await prisma.solicitacao.count({ where: { id: solicitacao.id } })).toBe(1);
      expect(await prisma.orcamento.count({ where: { id: orcamento.id } })).toBe(1);
    } finally {
      await limpar(dados);
    }
  });

  it('enum de estado: solicitação com status válido é criada e status inexistente é rejeitado como PrismaClientValidationError', async () => {
    const dados: Dados = { userIds: [], solicitacaoIds: [], orcamentoIds: [] };
    try {
      const solicitante = await criarUsuario(dados, `${PREFIXO_EMAIL}-enum@test.local`);
      const solicitacao = await criarSolicitacao(dados, solicitante.id, 'AGUARDANDO_APROVACAO_SETOR');
      expect(solicitacao.status).toBe('AGUARDANDO_APROVACAO_SETOR');

      await expect(
        prisma.solicitacao.create({
          data: {
            descricao: `${PREFIXO_EMAIL}-enum-invalido`,
            status: 'ESTADO_INEXISTENTE' as EstadoSolicitacao,
            solicitanteId: solicitante.id,
            setorId,
          },
        }),
      ).rejects.toThrow(Prisma.PrismaClientValidationError);

      const criadas = await prisma.solicitacao.count({
        where: { descricao: `${PREFIXO_EMAIL}-enum-invalido` },
      });
      expect(criadas).toBe(0);
    } finally {
      await limpar(dados);
    }
  });

  it('unicidade de e-mail: 2º usuário com o mesmo e-mail é rejeitado com P2002', async () => {
    const dados: Dados = { userIds: [], solicitacaoIds: [], orcamentoIds: [] };
    try {
      const email = `${PREFIXO_EMAIL}-email-duplicado@test.local`;
      await criarUsuario(dados, email);

      await expect(
        prisma.usuario.create({
          data: { nome: 'Usuario duplicado', email, senhaHash: 'hash-teste', perfilId, setorId },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const usuarios = await prisma.usuario.count({ where: { email } });
      expect(usuarios).toBe(1);
    } finally {
      await limpar(dados);
    }
  });

  it('FK de perfil/setor: usuário com perfilId ou setorId inexistentes é rejeitado com P2003', async () => {
    const dados: Dados = { userIds: [], solicitacaoIds: [], orcamentoIds: [] };
    try {
      await expect(
        prisma.usuario.create({
          data: {
            nome: 'Usuario perfil inexistente',
            email: `${PREFIXO_EMAIL}-fk-perfil@test.local`,
            senhaHash: 'hash-teste',
            perfilId: 999999999,
            setorId,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });

      await expect(
        prisma.usuario.create({
          data: {
            nome: 'Usuario setor inexistente',
            email: `${PREFIXO_EMAIL}-fk-setor@test.local`,
            senhaHash: 'hash-teste',
            perfilId,
            setorId: 999999999,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      await limpar(dados);
    }
  });

  it('sanidade do seed: setores=4, perfis=6, permissoes=66 e usuarios>=7 (somente leitura)', async () => {
    const [setores, perfis, permissoes, usuarios] = await Promise.all([
      prisma.setor.count(),
      prisma.perfil.count(),
      prisma.permissao.count(),
      prisma.usuario.count(),
    ]);

    expect(setores).toBe(4);
    expect(perfis).toBe(6);
    expect(permissoes).toBe(66);
    expect(usuarios).toBeGreaterThanOrEqual(7);
  });

  it('compras 1:1: 2ª compra para a mesma solicitação é rejeitada com P2002', async () => {
    const dados: Dados = { userIds: [], solicitacaoIds: [], orcamentoIds: [] };
    try {
      const executante = await criarUsuario(dados, `${PREFIXO_EMAIL}-compra@test.local`);
      const solicitacao = await criarSolicitacao(dados, executante.id, 'COMPRA_EM_ANDAMENTO');
      const orcamento = await criarOrcamento(dados, solicitacao.id);

      const primeira = await prisma.compra.create({
        data: { solicitacaoId: solicitacao.id, orcamentoId: orcamento.id, executanteId: executante.id },
      });
      expect(primeira.solicitacaoId).toBe(solicitacao.id);

      await expect(
        prisma.compra.create({
          data: { solicitacaoId: solicitacao.id, orcamentoId: orcamento.id, executanteId: executante.id },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const compras = await prisma.compra.count({ where: { solicitacaoId: solicitacao.id } });
      expect(compras).toBe(1);
    } finally {
      await limpar(dados);
    }
  });
});
