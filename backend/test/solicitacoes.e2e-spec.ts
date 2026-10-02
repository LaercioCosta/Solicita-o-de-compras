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
const EMAIL_SOLICITANTE_2 = 'segundo.solicitante@compras.teste';
const EMAIL_GERENTE_MKT = 'bruno.lima@compras.local';
const EMAIL_GERENTE_COMERCIAL = 'gabriela.norte@compras.local';
const EMAIL_GF = 'carla.mendes@compras.local';
const EMAIL_FINANCEIRO = 'elisa.rae@compras.local';
const EMAIL_TI = 'davi.costa@compras.local';
const EMAIL_ADMIN = 'felipe.cruz@compras.local';

const ITENS_PADRAO = [
  { produto: 'Notebook', quantidade: 2, valorUnitarioEstimado: 3500.5 },
  { produto: 'Mouse sem fio', quantidade: 3, valorUnitarioEstimado: 80 },
];

interface SolicitacaoResumida {
  id: number;
  solicitanteId: number;
  setor: { id: number; slug: string; nome: string };
  _count: { orcamentos: number; itens: number };
}

describe('Solicitacoes (e2e) — ciclo criação → orçamentos → submissão → cancelamento', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let anaId = 0;
  let idSetorMkt = 0;
  let idUsuarioTeste = 0;
  let idPrincipal = 0;
  let idComOrcamentos = 0;
  let idParaSubmeter = 0;
  let idCancelada = 0;
  let tokenAna = '';
  let tokenSolicitante2 = '';
  let tokenGerenteMkt = '';
  let tokenGerenteComercial = '';
  let tokenGf = '';
  let tokenFinanceiro = '';
  let tokenTi = '';
  let tokenAdmin = '';
  const idsSolicitacoes: number[] = [];
  const idsOrcamentos: number[] = [];
  const idsDocumentos: number[] = [];

  function servidor() {
    return request(app.getHttpServer());
  }

  async function obterToken(email: string, senha: string): Promise<string> {
    const resposta = await servidor()
      .post('/api/auth/login')
      .send({ email, senha });
    return resposta.body.accessToken as string;
  }

  async function criarSolicitacao(token: string): Promise<number> {
    const resposta = await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: 'Compra de material de teste', itens: ITENS_PADRAO })
      .expect(201);
    const id = resposta.body.id as number;
    idsSolicitacoes.push(id);
    return id;
  }

  function orcamentoValido(indice: number): {
    linkLoja: string;
    cnpjLoja: string;
    valor: number;
    validadeAte?: string;
  } {
    return {
      linkLoja: `https://loja${indice}.example.com.br/orcamento`,
      cnpjLoja: '12345678000190',
      valor: 150 + indice,
      validadeAte: '2026-12-31T00:00:00.000Z',
    };
  }

  async function criarOrcamento(
    token: string,
    idSolicitacao: number,
    dados: ReturnType<typeof orcamentoValido>,
  ): Promise<number> {
    const resposta = await servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/orcamentos`)
      .set('Authorization', `Bearer ${token}`)
      .send(dados)
      .expect(201);
    const id = resposta.body.id as number;
    idsOrcamentos.push(id);
    return id;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '::1');
    prisma = app.get(PrismaService);

    const setorMkt = await prisma.setor.findUniqueOrThrow({
      where: { slug: 'MKT' },
    });
    idSetorMkt = setorMkt.id;
    const perfilSolicitante = await prisma.perfil.findUniqueOrThrow({
      where: { slug: 'SOLICITANTE' },
    });
    const usuarioTeste = await prisma.usuario.create({
      data: {
        nome: 'Segundo Solicitante',
        email: EMAIL_SOLICITANTE_2,
        senhaHash: await hash(SENHA_TESTE),
        perfilId: perfilSolicitante.id,
        setorId: setorMkt.id,
      },
    });
    idUsuarioTeste = usuarioTeste.id;

    const ana = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_SOLICITANTE },
    });
    anaId = ana.id;

    tokenAna = await obterToken(EMAIL_SOLICITANTE, SENHA_DEV);
    tokenSolicitante2 = await obterToken(EMAIL_SOLICITANTE_2, SENHA_TESTE);
    tokenGerenteMkt = await obterToken(EMAIL_GERENTE_MKT, SENHA_DEV);
    tokenGerenteComercial = await obterToken(
      EMAIL_GERENTE_COMERCIAL,
      SENHA_DEV,
    );
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
      await prisma.auditoria.deleteMany({
        where: { entidade: 'solicitacao', entidadeId: { in: idsSolicitacoes } },
      });
      if (idsDocumentos.length > 0) {
        await prisma.documento.deleteMany({
          where: { id: { in: idsDocumentos } },
        });
      }
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
    if (prisma && idsOrcamentos.length > 0) {
      await prisma.auditoria.deleteMany({
        where: { entidade: 'orcamento', entidadeId: { in: idsOrcamentos } },
      });
    }
    if (prisma && idUsuarioTeste > 0) {
      await prisma.auditoria.deleteMany({
        where: { usuarioId: idUsuarioTeste },
      });
      await prisma.usuario.delete({ where: { id: idUsuarioTeste } });
    }
    if (app) {
      await app.close();
    }
  });

  it('1. criar com itens → 201 RASCUNHO e itens visíveis via GET', async () => {
    idPrincipal = await criarSolicitacao(tokenAna);

    const resposta = await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    expect(resposta.body.status).toBe('RASCUNHO');
    expect(resposta.body.cicloAprovacao).toBe(1);
    expect(resposta.body.solicitanteId).toBe(anaId);
    expect(resposta.body.itens).toHaveLength(2);
    expect(resposta.body.itens[0].produto).toBe('Notebook');
  });

  it('2. criar sem itens → 400; GERENTE sem solicitacao.criar → 403', async () => {
    await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ descricao: 'Sem itens', itens: [] })
      .expect(400);

    await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ descricao: 'Gerente não cria', itens: ITENS_PADRAO })
      .expect(403);
  });

  it('3. 3 orçamentos OK (validadeAte opcional); 4º → 422; linkLoja inválido → 400; cnpj errado → 400', async () => {
    idComOrcamentos = await criarSolicitacao(tokenAna);
    await criarOrcamento(tokenAna, idComOrcamentos, orcamentoValido(1));
    await criarOrcamento(tokenAna, idComOrcamentos, orcamentoValido(2));
    const semValidade = orcamentoValido(3);
    delete semValidade.validadeAte;
    await criarOrcamento(tokenAna, idComOrcamentos, semValidade);

    await servidor()
      .post(`/api/solicitacoes/${idComOrcamentos}/orcamentos`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send(orcamentoValido(4))
      .expect(422);

    await servidor()
      .post(`/api/solicitacoes/${idComOrcamentos}/orcamentos`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ ...orcamentoValido(5), linkLoja: 'ftp://loja.example.com' })
      .expect(400);

    await servidor()
      .post(`/api/solicitacoes/${idComOrcamentos}/orcamentos`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ ...orcamentoValido(6), cnpjLoja: '1234567800019' })
      .expect(400);
  });

  it('4. submeter sem 3 orçamentos → 422 e status segue RASCUNHO', async () => {
    idParaSubmeter = await criarSolicitacao(tokenAna);
    await criarOrcamento(tokenAna, idParaSubmeter, orcamentoValido(1));
    await criarOrcamento(tokenAna, idParaSubmeter, orcamentoValido(2));

    await servidor()
      .post(`/api/solicitacoes/${idParaSubmeter}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(422);

    const resposta = await servidor()
      .get(`/api/solicitacoes/${idParaSubmeter}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    expect(resposta.body.status).toBe('RASCUNHO');
  });

  it('5. submeter com 3 → AGUARDANDO_APROVACAO_SETOR; reenviar → 409; orçamento pós-submissão → 409', async () => {
    await criarOrcamento(tokenAna, idParaSubmeter, orcamentoValido(3));

    const resposta = await servidor()
      .post(`/api/solicitacoes/${idParaSubmeter}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    expect(resposta.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');

    await servidor()
      .post(`/api/solicitacoes/${idParaSubmeter}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(409);

    await servidor()
      .post(`/api/solicitacoes/${idParaSubmeter}/orcamentos`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send(orcamentoValido(4))
      .expect(409);
  });

  it('6. segundo SOLICITANTE não acessa solicitação alheia → 404 em GET/PATCH/submeter/cancelar', async () => {
    const url = `/api/solicitacoes/${idPrincipal}`;

    await servidor()
      .get(url)
      .set('Authorization', `Bearer ${tokenSolicitante2}`)
      .expect(404);

    await servidor()
      .patch(url)
      .set('Authorization', `Bearer ${tokenSolicitante2}`)
      .send({ descricao: 'Tentativa alheia' })
      .expect(404);

    await servidor()
      .post(`${url}/submeter`)
      .set('Authorization', `Bearer ${tokenSolicitante2}`)
      .expect(404);

    await servidor()
      .post(`${url}/cancelar`)
      .set('Authorization', `Bearer ${tokenSolicitante2}`)
      .send({ motivo: 'Tentativa alheia' })
      .expect(404);
  });

  it('7. GERENTE de outro setor → 404; GERENTE do setor → 200 (listagem e detalhe)', async () => {
    await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenGerenteComercial}`)
      .expect(404);

    await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(200);

    const listaMkt = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(200);

    const doMkt = (listaMkt.body as SolicitacaoResumida[]).some(
      (solicitacao) => solicitacao.id === idPrincipal,
    );
    expect(doMkt).toBe(true);

    const listaComercial = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenGerenteComercial}`)
      .expect(200);

    const doComercial = (listaComercial.body as SolicitacaoResumida[]).some(
      (solicitacao) => solicitacao.id === idPrincipal,
    );
    expect(doComercial).toBe(false);
  });

  it('8. GF vê RASCUNHO → 200; FINANCEIRO e TI não veem RASCUNHO (404/lista vazia); ADMIN → 403', async () => {
    await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .expect(200);

    await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenFinanceiro}`)
      .expect(404);

    const listaFinanceiro = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenFinanceiro}`)
      .expect(200);
    expect(listaFinanceiro.body).toHaveLength(0);

    await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(404);

    const listaTi = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    expect(listaTi.body).toHaveLength(0);

    await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);
  });

  it('9. cancelar em RASCUNHO → CANCELADO; cancelar de novo → 409; GERENTE cancelando → 403; edição pós-cancelamento → 409', async () => {
    idCancelada = await criarSolicitacao(tokenAna);

    const resposta = await servidor()
      .post(`/api/solicitacoes/${idCancelada}/cancelar`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ motivo: 'Não é mais necessário' })
      .expect(200);

    expect(resposta.body.status).toBe('CANCELADO');
    expect(resposta.body.motivoCancelamento).toBe('Não é mais necessário');

    await servidor()
      .post(`/api/solicitacoes/${idCancelada}/cancelar`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ motivo: 'Cancelar de novo' })
      .expect(409);

    await servidor()
      .post(`/api/solicitacoes/${idCancelada}/cancelar`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ motivo: 'Gerente não cancela' })
      .expect(403);

    await servidor()
      .patch(`/api/solicitacoes/${idCancelada}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ descricao: 'Editar cancelada' })
      .expect(409);
  });

  it('9b. CA-12.2: solicitante cancela a própria em AGUARDANDO_CORRECAO → CANCELADO (DEC-014)', async () => {
    const id = await criarSolicitacao(tokenAna);
    for (let indice = 1; indice <= 3; indice += 1) {
      await criarOrcamento(tokenAna, id, orcamentoValido(indice));
    }
    await servidor()
      .post(`/api/solicitacoes/${id}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    await servidor()
      .post(`/api/solicitacoes/${id}/devolver-correcao`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ motivo: 'Detalhar melhor o item' })
      .expect(200);

    const resposta = await servidor()
      .post(`/api/solicitacoes/${id}/cancelar`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ motivo: 'Desisti após a correção' })
      .expect(200);

    expect(resposta.body.status).toBe('CANCELADO');
    expect(resposta.body.motivoCancelamento).toBe('Desisti após a correção');

    const registros = await prisma.auditoria.findMany({
      where: { entidade: 'solicitacao', entidadeId: id, acao: 'CANCELAR' },
    });
    expect(registros).toHaveLength(1); // CA-12.6
    expect(registros[0].estadoNovo).toBe('CANCELADO');
  });

  it('9c. CA-12.3: cancelamento é rejeitado nos estados de aprovação (DEC-014)', async () => {
    const id = await criarSolicitacao(tokenAna);
    const idsOrcamentosLocais: number[] = [];
    for (let indice = 1; indice <= 3; indice += 1) {
      idsOrcamentosLocais.push(await criarOrcamento(tokenAna, id, orcamentoValido(indice)));
    }
    await servidor()
      .post(`/api/solicitacoes/${id}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    // AGUARDANDO_APROVACAO_SETOR → rejeitado; estado preservado
    await servidor()
      .post(`/api/solicitacoes/${id}/cancelar`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ motivo: 'Tentar cancelar no fluxo' })
      .expect(409);
    const emSetor = await servidor()
      .get(`/api/solicitacoes/${id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(emSetor.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');

    // avança para AGUARDANDO_APROVACAO_FINANCEIRA → rejeitado também
    await servidor()
      .post(`/api/solicitacoes/${id}/decisao`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ orcamentoId: idsOrcamentosLocais[0], decisao: 'APROVADO' })
      .expect(200);
    await servidor()
      .post(`/api/solicitacoes/${id}/cancelar`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ motivo: 'Tentar de novo' })
      .expect(409);
    const emFinanceira = await servidor()
      .get(`/api/solicitacoes/${id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(emFinanceira.body.status).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');
  });

  it('10. PATCH em RASCUNHO atualiza descricao e substitui itens (RN-07a)', async () => {
    const resposta = await servidor()
      .patch(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({
        descricao: 'Descrição revisada',
        itens: [
          {
            produto: 'Monitor 27 polegadas',
            quantidade: 1,
            valorUnitarioEstimado: 1200,
          },
        ],
      })
      .expect(200);

    expect(resposta.body.descricao).toBe('Descrição revisada');
    expect(resposta.body.itens).toHaveLength(1);
    expect(resposta.body.itens[0].produto).toBe('Monitor 27 polegadas');

    const detalhe = await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    expect(detalhe.body.itens).toHaveLength(1);
  });

  it('11. PATCH após submissão reabre o fluxo (RN-07(b)/DEC-015 — Fase 4)', async () => {
    const resposta = await servidor()
      .patch(`/api/solicitacoes/${idParaSubmeter}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ descricao: 'Tentativa pós-submissão' })
      .expect(200);

    expect(resposta.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(resposta.body.cicloAprovacao).toBe(2);

    const reabertura = await prisma.auditoria.findFirstOrThrow({
      where: {
        entidade: 'solicitacao',
        entidadeId: idParaSubmeter,
        acao: 'CORRIGIR',
      },
      orderBy: { id: 'desc' },
    });
    expect(reabertura.dados).toMatchObject({
      etapa: 'reabertura_aprovacao',
      cicloNovo: 2,
      camposAlterados: ['descricao'],
    });
  });

  it('11b. PATCH com ITENS pós-submissão reabre o fluxo e substitui os itens (RN-07(b)/CA-13.1 — TASK-068)', async () => {
    const id = await criarSolicitacao(tokenAna);
    for (let indice = 1; indice <= 3; indice += 1) {
      await criarOrcamento(tokenAna, id, orcamentoValido(indice));
    }
    await servidor()
      .post(`/api/solicitacoes/${id}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    const resposta = await servidor()
      .patch(`/api/solicitacoes/${id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({
        itens: [
          {
            produto: 'Impressora multifuncional revisada',
            quantidade: 2,
            valorUnitarioEstimado: 800,
          },
        ],
      })
      .expect(200);

    expect(resposta.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(resposta.body.cicloAprovacao).toBe(2);
    expect(resposta.body.itens).toHaveLength(1);
    expect(resposta.body.itens[0].produto).toBe('Impressora multifuncional revisada');

    const itensPersistidos = await prisma.solicitacaoItem.findMany({
      where: { solicitacaoId: id },
    });
    expect(itensPersistidos).toHaveLength(1);
    expect(itensPersistidos[0].produto).toBe('Impressora multifuncional revisada');

    const reabertura = await prisma.auditoria.findFirstOrThrow({
      where: {
        entidade: 'solicitacao',
        entidadeId: id,
        acao: 'CORRIGIR',
        estadoNovo: 'AGUARDANDO_APROVACAO_SETOR',
      },
      orderBy: { id: 'desc' },
    });
    expect(reabertura.dados).toMatchObject({
      etapa: 'reabertura_aprovacao',
      cicloNovo: 2,
      camposAlterados: ['itens'],
    });
  });

  it('12. listagem paginada com limit/offset (máx 100) e _count de orcamentos/itens', async () => {
    const pagina = await servidor()
      .get('/api/solicitacoes?limit=1&offset=0')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    expect(pagina.body).toHaveLength(1);
    expect(pagina.body[0].solicitanteId).toBe(anaId);

    const listaCompleta = await servidor()
      .get('/api/solicitacoes?limit=100')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    const comTres = (listaCompleta.body as SolicitacaoResumida[]).find(
      (solicitacao) => solicitacao.id === idComOrcamentos,
    );
    expect(comTres?._count.orcamentos).toBe(3);
    expect(comTres?._count.itens).toBe(2);

    await servidor()
      .get('/api/solicitacoes?limit=101')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(400);

    await servidor()
      .get('/api/solicitacoes?limit=0')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(400);

    await servidor()
      .get('/api/solicitacoes?offset=-5')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(400);
  });

  it('13. auditoria registra CRIAR/SUBMETER/CANCELAR com estados corretos (RN-05)', async () => {
    const registrosSubmetida = await prisma.auditoria.findMany({
      where: { entidade: 'solicitacao', entidadeId: idParaSubmeter },
      orderBy: { id: 'asc' },
    });

    const criar = registrosSubmetida.find(
      (registro) => registro.acao === 'CRIAR',
    );
    expect(criar?.estadoNovo).toBe('RASCUNHO');
    expect(criar?.usuarioId).toBe(anaId);
    expect(criar?.perfil).toBe('SOLICITANTE');

    const submeter = registrosSubmetida.find(
      (registro) => registro.acao === 'SUBMETER',
    );
    expect(submeter?.estadoAnterior).toBe('RASCUNHO');
    expect(submeter?.estadoNovo).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(submeter?.usuarioId).toBe(anaId);

    const registrosCancelada = await prisma.auditoria.findMany({
      where: { entidade: 'solicitacao', entidadeId: idCancelada },
    });

    const cancelar = registrosCancelada.find(
      (registro) => registro.acao === 'CANCELAR',
    );
    expect(cancelar?.estadoAnterior).toBe('RASCUNHO');
    expect(cancelar?.estadoNovo).toBe('CANCELADO');
    expect(cancelar?.usuarioId).toBe(anaId);

    const auditoriaOrcamento = await prisma.auditoria.findFirst({
      where: { entidade: 'orcamento', entidadeId: idsOrcamentos[0] },
    });
    expect(auditoriaOrcamento?.acao).toBe('CRIAR');
  });

  it('14. listagem (GERENTE) retorna setor {id, slug, nome} em cada item', async () => {
    const listaMkt = await servidor()
      .get('/api/solicitacoes?limit=100')
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(200);

    expect(listaMkt.body.length).toBeGreaterThan(0);
    for (const item of listaMkt.body as SolicitacaoResumida[]) {
      expect(item.setor).toEqual({
        id: idSetorMkt,
        slug: 'MKT',
        nome: 'Marketing',
      });
    }

    const alvo = (listaMkt.body as SolicitacaoResumida[]).find(
      (solicitacao) => solicitacao.id === idComOrcamentos,
    );
    expect(alvo?.setor.nome).toBe('Marketing');
  });

  it('15. detalhe pré-compra: compra=null, pagamento=null e documentos=[]', async () => {
    const resposta = await servidor()
      .get(`/api/solicitacoes/${idPrincipal}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    expect(resposta.body.setor).toEqual({
      id: idSetorMkt,
      slug: 'MKT',
      nome: 'Marketing',
    });
    expect(resposta.body.compra).toBeNull();
    expect(resposta.body.pagamento).toBeNull();
    expect(resposta.body.documentos).toEqual([]);
  });

  it('16. detalhe inclui documento do orçamento sem vazar nomeArmazenado/hash', async () => {
    const orcamentoAlvo = await prisma.orcamento.findFirstOrThrow({
      where: { solicitacaoId: idComOrcamentos },
      orderBy: { id: 'asc' },
    });

    const documento = await prisma.documento.create({
      data: {
        tipo: 'ORCAMENTO',
        nomeOriginal: 'orcamento-loja1.pdf',
        mimeType: 'application/pdf',
        tamanhoBytes: 2048,
        hash: 'hash-fixo-teste-orcamento',
        nomeArmazenado: 'uuid-fixo-teste-orcamento.pdf',
        donoId: anaId,
        orcamentoId: orcamentoAlvo.id,
      },
    });
    idsDocumentos.push(documento.id);

    const resposta = await servidor()
      .get(`/api/solicitacoes/${idComOrcamentos}`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(200);

    expect(resposta.body.compra).toBeNull();
    expect(resposta.body.pagamento).toBeNull();
    expect(resposta.body.documentos).toHaveLength(1);
    expect(resposta.body.documentos[0]).toEqual({
      id: documento.id,
      tipo: 'ORCAMENTO',
      nomeOriginal: 'orcamento-loja1.pdf',
      mimeType: 'application/pdf',
      tamanhoBytes: 2048,
      orcamentoId: orcamentoAlvo.id,
      compraId: null,
      pagamentoId: null,
    });

    const payload = JSON.stringify(resposta.body);
    expect(payload).not.toContain('nomeArmazenado');
    expect(payload).not.toContain('hash');
    expect(payload).not.toContain('hash-fixo-teste-orcamento');
    expect(payload).not.toContain('uuid-fixo-teste-orcamento');
  });
});
