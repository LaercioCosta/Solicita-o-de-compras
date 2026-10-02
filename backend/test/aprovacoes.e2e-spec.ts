import { hash } from '@node-rs/argon2';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { configureApp } from '../src/app.configuration.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const SENHA_DEV = 'SenhaDev123!';
const SENHA_TESTE = 'SenhaTeste123!';
const EMAIL_SOLICITANTE = 'ana.souza@compras.local';
const EMAIL_GERENTE_MKT = 'bruno.lima@compras.local';
const EMAIL_GERENTE_COMERCIAL = 'gabriela.norte@compras.local';
const EMAIL_GF = 'carla.mendes@compras.local';
const EMAIL_FINANCEIRO = 'elisa.rae@compras.local';
const EMAIL_TI = 'davi.costa@compras.local';
const EMAIL_ADMIN = 'felipe.cruz@compras.local';
const EMAIL_SOLICITANTE_OFICINA = 'solicitante.oficina@compras.teste';
const EMAIL_TI_TESTE = 'ti.teste@compras.teste';
const EMAIL_GERENTE_OFICINA = 'gerente.oficina@compras.teste';

const ITENS_PADRAO = [
  { produto: 'Cadeira ergonômica', quantidade: 1, valorUnitarioEstimado: 900 },
];

interface NotificacaoResposta {
  id: number;
  mensagem: string;
  lida: boolean;
  lidaEm: string | null;
  createdAt: string;
  solicitacaoId: number | null;
}

describe('Aprovacoes (e2e) — decisões em 2 níveis, DEC-019, DEC-022 e notificações da TI', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let carlaId = 0;
  let brunoId = 0;
  let idSolicitanteOficina = 0;
  let idTiTeste = 0;
  let idGerenteOficina = 0;
  let tokenGerenteOficina = '';
  let tokenAna = '';
  let tokenSolicitanteOficina = '';
  let tokenGerenteMkt = '';
  let tokenGerenteComercial = '';
  let tokenGf = '';
  let tokenFinanceiro = '';
  let tokenTi = '';
  let tokenAdmin = '';
  const idsSolicitacoes: number[] = [];
  const idsOrcamentos: number[] = [];

  function servidor() {
    return request(app.getHttpServer());
  }

  async function obterToken(email: string, senha: string): Promise<string> {
    const resposta = await servidor()
      .post('/api/auth/login')
      .send({ email, senha });
    return resposta.body.accessToken as string;
  }

  async function criarSolicitacao(token: string, descricao: string): Promise<number> {
    const resposta = await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao, itens: ITENS_PADRAO })
      .expect(201);
    const id = resposta.body.id as number;
    idsSolicitacoes.push(id);
    return id;
  }

  async function criarOrcamento(token: string, idSolicitacao: number): Promise<number> {
    const resposta = await servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/orcamentos`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        linkLoja: 'https://loja.example.com.br/orcamento',
        cnpjLoja: '12345678000190',
        valor: 150,
      })
      .expect(201);
    const id = resposta.body.id as number;
    idsOrcamentos.push(id);
    return id;
  }

  async function criarFluxoSubmetido(
    token: string,
    descricao: string,
  ): Promise<{ id: number; orcamentos: number[] }> {
    const id = await criarSolicitacao(token, descricao);
    const orcamentos: number[] = [];
    for (let indice = 0; indice < 3; indice += 1) {
      orcamentos.push(await criarOrcamento(token, id));
    }
    await servidor()
      .post(`/api/solicitacoes/${id}/submeter`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return { id, orcamentos };
  }

  function decidir(
    token: string,
    idSolicitacao: number,
    orcamentoId: number,
    decisao: 'APROVADO' | 'REPROVADO',
    observacao?: string,
  ) {
    return servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/decisao`)
      .set('Authorization', `Bearer ${token}`)
      .send({ orcamentoId, decisao, ...(observacao ? { observacao } : {}) });
  }

  async function statusViaGet(token: string, idSolicitacao: number): Promise<string> {
    const resposta = await servidor()
      .get(`/api/solicitacoes/${idSolicitacao}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return resposta.body.status as string;
  }

  async function notificacoesDavi(
    idSolicitacao: number,
  ): Promise<NotificacaoResposta[]> {
    const resposta = await servidor()
      .get('/api/notificacoes')
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    const notificacoes = resposta.body as NotificacaoResposta[];
    return notificacoes.filter((item) => item.solicitacaoId === idSolicitacao);
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '::1');
    prisma = app.get(PrismaService);

    const setorOficina = await prisma.setor.findUniqueOrThrow({
      where: { slug: 'OFICINA' },
    });
    const perfilSolicitante = await prisma.perfil.findUniqueOrThrow({
      where: { slug: 'SOLICITANTE' },
    });
    const perfilTi = await prisma.perfil.findUniqueOrThrow({
      where: { slug: 'TI' },
    });

    const senhaHash = await hash(SENHA_TESTE);
    const solicitanteOficina = await prisma.usuario.create({
      data: {
        nome: 'Solicitante Oficina Teste',
        email: EMAIL_SOLICITANTE_OFICINA,
        senhaHash,
        perfilId: perfilSolicitante.id,
        setorId: setorOficina.id,
      },
    });
    idSolicitanteOficina = solicitanteOficina.id;

    const usuarioTiTeste = await prisma.usuario.create({
      data: {
        nome: 'TI Teste',
        email: EMAIL_TI_TESTE,
        senhaHash,
        perfilId: perfilTi.id,
        setorId: setorOficina.id,
      },
    });
    idTiTeste = usuarioTiTeste.id;

    const perfilGerente = await prisma.perfil.findUniqueOrThrow({
      where: { slug: 'GERENTE' },
    });
    const gerenteOficina = await prisma.usuario.create({
      data: {
        nome: 'Gerente Oficina Teste',
        email: EMAIL_GERENTE_OFICINA,
        senhaHash,
        perfilId: perfilGerente.id,
        setorId: setorOficina.id,
      },
    });
    idGerenteOficina = gerenteOficina.id;

    const carla = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_GF },
    });
    carlaId = carla.id;
    const bruno = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_GERENTE_MKT },
    });
    brunoId = bruno.id;

    tokenAna = await obterToken(EMAIL_SOLICITANTE, SENHA_DEV);
    tokenSolicitanteOficina = await obterToken(EMAIL_SOLICITANTE_OFICINA, SENHA_TESTE);
    tokenGerenteMkt = await obterToken(EMAIL_GERENTE_MKT, SENHA_DEV);
    tokenGerenteComercial = await obterToken(EMAIL_GERENTE_COMERCIAL, SENHA_DEV);
    tokenGerenteOficina = await obterToken(EMAIL_GERENTE_OFICINA, SENHA_TESTE);
    tokenGf = await obterToken(EMAIL_GF, SENHA_DEV);
    tokenFinanceiro = await obterToken(EMAIL_FINANCEIRO, SENHA_DEV);
    tokenTi = await obterToken(EMAIL_TI, SENHA_DEV);
    tokenAdmin = await obterToken(EMAIL_ADMIN, SENHA_DEV);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.sessao.deleteMany({});
    }
    if (prisma && idsSolicitacoes.length > 0) {
      await prisma.notificacao.deleteMany({
        where: { solicitacaoId: { in: idsSolicitacoes } },
      });
      await prisma.auditoria.deleteMany({
        where: {
          OR: [
            { entidade: 'solicitacao', entidadeId: { in: idsSolicitacoes } },
            { entidade: 'orcamento', entidadeId: { in: idsOrcamentos } },
          ],
        },
      });
      await prisma.aprovacao.deleteMany({
        where: { solicitacaoId: { in: idsSolicitacoes } },
      });
      await prisma.orcamento.deleteMany({
        where: { solicitacaoId: { in: idsSolicitacoes } },
      });
      await prisma.solicitacaoItem.deleteMany({
        where: { solicitacaoId: { in: idsSolicitacoes } },
      });
      await prisma.solicitacao.deleteMany({
        where: { id: { in: idsSolicitacoes } },
      });
    }
    if (prisma && idSolicitanteOficina > 0) {
      await prisma.auditoria.deleteMany({
        where: { usuarioId: idSolicitanteOficina },
      });
      await prisma.usuario.delete({ where: { id: idSolicitanteOficina } });
    }
    if (prisma && idTiTeste > 0) {
      await prisma.notificacao.deleteMany({ where: { usuarioId: idTiTeste } });
      await prisma.auditoria.deleteMany({ where: { usuarioId: idTiTeste } });
      await prisma.usuario.delete({ where: { id: idTiTeste } });
    }
    if (prisma && idGerenteOficina > 0) {
      await prisma.auditoria.deleteMany({ where: { usuarioId: idGerenteOficina } });
      await prisma.usuario.delete({ where: { id: idGerenteOficina } });
    }
    if (app) {
      await app.close();
    }
  });

  it('1. gerente do setor aprova vinculando orçamento → AGUARDANDO_APROVACAO_FINANCEIRA', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT fluxo principal');

    const resposta = await decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'APROVADO', 'Melhor preço')
      .expect(200);
    expect(resposta.body.status).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');

    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');

    const aprovacao = await prisma.aprovacao.findFirstOrThrow({
      where: { solicitacaoId: fluxo.id },
    });
    expect(aprovacao.nivel).toBe('SETOR');
    expect(aprovacao.decisao).toBe('APROVADO');
    expect(aprovacao.orcamentoId).toBe(fluxo.orcamentos[0]);
    expect(aprovacao.aprovadorId).toBe(brunoId);
    expect(aprovacao.cicloAprovacao).toBe(1);
    expect(aprovacao.observacao).toBe('Melhor preço');
  });

  it('2. gerente de outro setor → 404; FINANCEIRO/SOLICITANTE/TI/ADMIN → 403', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT negativas nível setor');

    await decidir(tokenGerenteComercial, fluxo.id, fluxo.orcamentos[0], 'APROVADO')
      .expect(404);

    await decidir(tokenFinanceiro, fluxo.id, fluxo.orcamentos[0], 'APROVADO')
      .expect(403);

    await decidir(tokenAna, fluxo.id, fluxo.orcamentos[0], 'APROVADO')
      .expect(403);

    await decidir(tokenTi, fluxo.id, fluxo.orcamentos[0], 'APROVADO')
      .expect(403);

    await decidir(tokenAdmin, fluxo.id, fluxo.orcamentos[0], 'APROVADO')
      .expect(403);
  });

  it('3. GF aprova nível financeira → APROVADO e TODOS os usuários TI notificados', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT dois níveis');
    await decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'APROVADO').expect(200);

    const resposta = await decidir(tokenGf, fluxo.id, fluxo.orcamentos[1], 'APROVADO')
      .expect(200);
    expect(resposta.body.status).toBe('APROVADO');

    const notificacoes = await notificacoesDavi(fluxo.id);
    expect(notificacoes.length).toBeGreaterThanOrEqual(1);
    expect(notificacoes[0].mensagem).toContain(`#${fluxo.id}`);
    expect(notificacoes[0].lida).toBe(false);
    expect(notificacoes[0].lidaEm).toBeNull();
    expect(typeof notificacoes[0].createdAt).toBe('string');

    const notificacoesTiTeste = await prisma.notificacao.count({
      where: { usuarioId: idTiTeste, solicitacaoId: fluxo.id },
    });
    expect(notificacoesTiTeste).toBeGreaterThanOrEqual(1);

    const aprovacoes = await prisma.aprovacao.findMany({
      where: { solicitacaoId: fluxo.id },
    });
    expect(aprovacoes).toHaveLength(2);
    expect(aprovacoes.filter((item) => item.nivel === 'FINANCEIRA')).toHaveLength(1);
  });

  it('4. com apenas 1 nível aprovado a TI NÃO é notificada (CA-03.5)', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT um nível');

    await decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'APROVADO').expect(200);

    expect((await notificacoesDavi(fluxo.id)).length).toBe(0);
    expect(
      await prisma.notificacao.count({
        where: { usuarioId: idTiTeste, solicitacaoId: fluxo.id },
      }),
    ).toBe(0);
  });

  it('5. reprovação no nível 1 → REPROVADO terminal; decisão posterior → 409', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT reprovada');

    const resposta = await decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'REPROVADO', 'Fora do orçamento')
      .expect(200);
    expect(resposta.body.status).toBe('REPROVADO');
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('REPROVADO');

    await decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'APROVADO').expect(409);
    await decidir(tokenGf, fluxo.id, fluxo.orcamentos[1], 'APROVADO').expect(409);
  });

  it('6. GF acumula os dois níveis em OFICINA (DEC-019) → APROVADO', async () => {
    const fluxo = await criarFluxoSubmetido(tokenSolicitanteOficina, 'Solicitação OFICINA acumulo GF');

    const primeira = await decidir(tokenGf, fluxo.id, fluxo.orcamentos[0], 'APROVADO')
      .expect(200);
    expect(primeira.body.status).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');

    const segunda = await decidir(tokenGf, fluxo.id, fluxo.orcamentos[1], 'APROVADO')
      .expect(200);
    expect(segunda.body.status).toBe('APROVADO');
    expect(await statusViaGet(tokenSolicitanteOficina, fluxo.id)).toBe('APROVADO');

    const aprovacoes = await prisma.aprovacao.findMany({
      where: { solicitacaoId: fluxo.id },
      orderBy: { id: 'asc' },
    });
    expect(aprovacoes).toHaveLength(2);
    expect(aprovacoes[0].nivel).toBe('SETOR');
    expect(aprovacoes[1].nivel).toBe('FINANCEIRA');
    expect(aprovacoes.every((item) => item.aprovadorId === carlaId)).toBe(true);
  });

  it('6b. GERENTE vinculado à OFICINA não aprova o 1º nível (DEC-019 — revisão Fase 10, achado #2)', async () => {
    const fluxo = await criarFluxoSubmetido(
      tokenSolicitanteOficina,
      'Solicitação OFICINA gerente vinculado',
    );

    await decidir(tokenGerenteOficina, fluxo.id, fluxo.orcamentos[0], 'APROVADO')
      .expect(404);
    expect(await statusViaGet(tokenSolicitanteOficina, fluxo.id)).toBe(
      'AGUARDANDO_APROVACAO_SETOR',
    );

    const decisoes = await prisma.aprovacao.count({
      where: { solicitacaoId: fluxo.id },
    });
    expect(decisoes).toBe(0);
  });

  it('7. GF NÃO acumula o 1º nível em MKT → 404 (documentado)', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT setor pendente');

    await decidir(tokenGf, fluxo.id, fluxo.orcamentos[0], 'APROVADO').expect(404);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('AGUARDANDO_APROVACAO_SETOR');
  });

  it('8. decisões simultâneas no mesmo nível/ciclo → 2ª recebe 409 (DEC-022)', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT concorrência');

    const [primeira, segunda] = await Promise.all([
      decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'APROVADO'),
      decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'APROVADO'),
    ]);

    const codigos = [primeira.status, segunda.status].sort((a, b) => a - b);
    expect(codigos).toEqual([200, 409]);

    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');

    const decisoesNivelSetor = await prisma.aprovacao.count({
      where: { solicitacaoId: fluxo.id, nivel: 'SETOR', cicloAprovacao: 1 },
    });
    expect(decisoesNivelSetor).toBe(1);
  });

  it('9. orcamentoId de outra solicitação → 422 e estado preservado', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT orçamento alheio');
    const outra = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT dona do orçamento');

    await decidir(tokenGerenteMkt, fluxo.id, outra.orcamentos[0], 'APROVADO').expect(422);

    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(
      await prisma.aprovacao.count({ where: { solicitacaoId: fluxo.id } }),
    ).toBe(0);
  });

  it('10. auditoria registra APROVAR/REPROVAR com orçamento, nível e estados (CA-02.5)', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Solicitação MKT auditoria decisão');
    await decidir(tokenGerenteMkt, fluxo.id, fluxo.orcamentos[0], 'APROVADO').expect(200);
    await decidir(tokenGf, fluxo.id, fluxo.orcamentos[1], 'REPROVADO', 'Sem verba')
      .expect(200);

    const registros = await prisma.auditoria.findMany({
      where: { entidade: 'solicitacao', entidadeId: fluxo.id },
      orderBy: { id: 'asc' },
    });

    const aprovarSetor = registros.find(
      (registro) => registro.acao === 'APROVAR',
    );
    expect(aprovarSetor?.estadoAnterior).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(aprovarSetor?.estadoNovo).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');
    expect(aprovarSetor?.usuarioId).toBe(brunoId);
    expect(aprovarSetor?.dados).toMatchObject({
      orcamentoId: fluxo.orcamentos[0],
      nivel: 'SETOR',
      decisao: 'APROVADO',
    });

    const reprovarFinanceira = registros.find(
      (registro) => registro.acao === 'REPROVAR',
    );
    expect(reprovarFinanceira?.estadoAnterior).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');
    expect(reprovarFinanceira?.estadoNovo).toBe('REPROVADO');
    expect(reprovarFinanceira?.usuarioId).toBe(carlaId);
    expect(reprovarFinanceira?.dados).toMatchObject({
      orcamentoId: fluxo.orcamentos[1],
      nivel: 'FINANCEIRA',
      decisao: 'REPROVADO',
    });
  });
});
