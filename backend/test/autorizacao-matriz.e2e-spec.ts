import { hash } from '@node-rs/argon2';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureApp } from '../src/app.configuration.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const SENHA_DEV = 'SenhaDev123!';
const SENHA_TESTE = 'SenhaTeste123!';
const EMAIL_SOLICITANTE = 'ana.souza@compras.local';
const EMAIL_SOLICITANTE_2 = 'matriz.solicitante@fluxo.teste';
const EMAIL_SOLICITANTE_OFICINA = 'matriz.oficina@fluxo.teste';
const EMAIL_GERENTE_MKT = 'bruno.lima@compras.local';
const EMAIL_GF = 'carla.mendes@compras.local';
const EMAIL_TI = 'davi.costa@compras.local';
const EMAIL_FINANCEIRO = 'elisa.rae@compras.local';
const EMAIL_ADMIN = 'felipe.cruz@compras.local';
const EMAIL_USUARIO_ADMIN_CRIADO = 'matriz.qa@fluxo.teste';

const ITENS_PADRAO = [
  { produto: 'Monitor', quantidade: 1, valorUnitarioEstimado: 900 },
];

const PDF_COMPROVANTE = Buffer.from(
  '%PDF-1.4\ncomprovante matriz autorizacao\n%%EOF',
);
const PDF_NF = Buffer.from('%PDF-1.4\nnota fiscal matriz autorizacao\n%%EOF');

const pastaUploads = fileURLToPath(new URL('../uploads/', import.meta.url));

interface Fluxo {
  id: number;
  orcamentos: number[];
}

describe('Matriz de autorização (e2e) — TASK-047: varredura sistemática por perfil', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let setorMktId = 0;
  let setorOficinaId = 0;
  let felipeId = 0;
  let tokenAna = '';
  let tokenSolicitante2 = '';
  let tokenSolicitanteOficina = '';
  let tokenGerenteMkt = '';
  let tokenGf = '';
  let tokenTi = '';
  let tokenFinanceiro = '';
  let tokenAdmin = '';
  let idPagamentoPrincipal = 0;
  let fluxoOficina: Fluxo | null = null;
  const idsSolicitacoes: number[] = [];
  const idsOrcamentos: number[] = [];
  const idsCompras: number[] = [];
  const idsPagamentos: number[] = [];
  const idsUsuariosCriados: number[] = [];
  const nomesArmazenados: string[] = [];

  function servidor() {
    return request(app.getHttpServer());
  }

  async function obterToken(email: string, senha: string): Promise<string> {
    const resposta = await servidor()
      .post('/api/auth/login')
      .send({ email, senha });
    return resposta.body.accessToken as string;
  }

  async function criarSolicitacao(
    token: string,
    descricao: string,
  ): Promise<number> {
    const resposta = await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao, itens: ITENS_PADRAO })
      .expect(201);
    const id = resposta.body.id as number;
    idsSolicitacoes.push(id);
    return id;
  }

  async function criarOrcamento(
    token: string,
    idSolicitacao: number,
    indice: number,
  ): Promise<number> {
    const resposta = await servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/orcamentos`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        linkLoja: `https://loja${indice}.example.com.br/matriz`,
        cnpjLoja: '12345678000190',
        valor: 300 + indice,
      })
      .expect(201);
    const id = resposta.body.id as number;
    idsOrcamentos.push(id);
    return id;
  }

  async function criarFluxoSubmetido(
    token: string,
    descricao: string,
  ): Promise<Fluxo> {
    const id = await criarSolicitacao(token, descricao);
    const orcamentos: number[] = [];
    for (let indice = 0; indice < 3; indice += 1) {
      orcamentos.push(await criarOrcamento(token, id, indice));
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
  ) {
    return servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/decisao`)
      .set('Authorization', `Bearer ${token}`)
      .send({ orcamentoId, decisao });
  }

  async function statusViaGet(
    token: string,
    idSolicitacao: number,
  ): Promise<string> {
    const resposta = await servidor()
      .get(`/api/solicitacoes/${idSolicitacao}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return resposta.body.status as string;
  }

  async function levarAteAguardandoFinanceiro(
    fluxo: Fluxo,
  ): Promise<void> {
    const respostaCompra = await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/compra`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    idsCompras.push(respostaCompra.body.id as number);

    const respostaPagamento = await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({
        forma: 'BOLETO',
        dados: 'boleto 12345.6789 12345.6789 1 2345678901',
      })
      .expect(200);
    idPagamentoPrincipal = respostaPagamento.body.id as number;
    idsPagamentos.push(idPagamentoPrincipal);

    expect(await statusViaGet(tokenAna, fluxo.id)).toBe(
      'AGUARDANDO_FINANCEIRO',
    );
  }

  function pagar(token: string, pagamentoId: number) {
    return servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${token}`)
      .field('valorPago', '900.00')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante-matriz.pdf');
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
    setorMktId = setorMkt.id;
    const setorOficina = await prisma.setor.findUniqueOrThrow({
      where: { slug: 'OFICINA' },
    });
    setorOficinaId = setorOficina.id;

    const felipe = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_ADMIN },
    });
    felipeId = felipe.id;

    const perfilSolicitante = await prisma.perfil.findUniqueOrThrow({
      where: { slug: 'SOLICITANTE' },
    });

    const senhaHash = await hash(SENHA_TESTE);
    for (const [nome, email, setorId] of [
      ['Matriz Solicitante 2', EMAIL_SOLICITANTE_2, setorMktId],
      ['Matriz Solicitante Oficina', EMAIL_SOLICITANTE_OFICINA, setorOficinaId],
    ] as const) {
      const usuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senhaHash,
          perfilId: perfilSolicitante.id,
          setorId,
        },
      });
      idsUsuariosCriados.push(usuario.id);
    }

    tokenAna = await obterToken(EMAIL_SOLICITANTE, SENHA_DEV);
    tokenSolicitante2 = await obterToken(EMAIL_SOLICITANTE_2, SENHA_TESTE);
    tokenSolicitanteOficina = await obterToken(
      EMAIL_SOLICITANTE_OFICINA,
      SENHA_TESTE,
    );
    tokenGerenteMkt = await obterToken(EMAIL_GERENTE_MKT, SENHA_DEV);
    tokenGf = await obterToken(EMAIL_GF, SENHA_DEV);
    tokenTi = await obterToken(EMAIL_TI, SENHA_DEV);
    tokenFinanceiro = await obterToken(EMAIL_FINANCEIRO, SENHA_DEV);
    tokenAdmin = await obterToken(EMAIL_ADMIN, SENHA_DEV);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.sessao.deleteMany({});
      const whereDocumentos = {
        OR: [
          { compraId: { in: idsCompras } },
          { pagamentoId: { in: idsPagamentos } },
        ],
      };
      const documentos = await prisma.documento.findMany({
        where: whereDocumentos,
      });
      nomesArmazenados.push(
        ...documentos.map((documento) => documento.nomeArmazenado),
      );
      for (const nome of nomesArmazenados) {
        await unlink(join(pastaUploads, nome)).catch(() => undefined);
      }
      await prisma.documento.deleteMany({ where: whereDocumentos });
      await prisma.pagamento.deleteMany({
        where: { id: { in: idsPagamentos } },
      });
      await prisma.compra.deleteMany({ where: { id: { in: idsCompras } } });
      if (idsSolicitacoes.length > 0) {
        await prisma.notificacao.deleteMany({
          where: { solicitacaoId: { in: idsSolicitacoes } },
        });
        await prisma.auditoria.deleteMany({
          where: {
            OR: [
              { entidade: 'solicitacao', entidadeId: { in: idsSolicitacoes } },
              { entidade: 'orcamento', entidadeId: { in: idsOrcamentos } },
              { entidade: 'compra', entidadeId: { in: idsCompras } },
              { entidade: 'pagamento', entidadeId: { in: idsPagamentos } },
              { entidade: 'usuario', entidadeId: { in: idsUsuariosCriados } },
              {
                entidade: 'setor',
                entidadeId: setorMktId,
                usuarioId: felipeId,
              },
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
      await prisma.usuario.deleteMany({
        where: { id: { in: idsUsuariosCriados } },
      });

      const contagens = {
        solicitacoes: await prisma.solicitacao.count({
          where: { id: { in: idsSolicitacoes } },
        }),
        orcamentos: await prisma.orcamento.count({
          where: { solicitacaoId: { in: idsSolicitacoes } },
        }),
        compras: await prisma.compra.count({
          where: { id: { in: idsCompras } },
        }),
        pagamentos: await prisma.pagamento.count({
          where: { id: { in: idsPagamentos } },
        }),
        aprovacoes: await prisma.aprovacao.count({
          where: { solicitacaoId: { in: idsSolicitacoes } },
        }),
        documentos: await prisma.documento.count({ where: whereDocumentos }),
        notificacoes: await prisma.notificacao.count({
          where: { solicitacaoId: { in: idsSolicitacoes } },
        }),
        auditoria: await prisma.auditoria.count({
          where: {
            OR: [
              { entidade: 'solicitacao', entidadeId: { in: idsSolicitacoes } },
              { entidade: 'orcamento', entidadeId: { in: idsOrcamentos } },
              { entidade: 'compra', entidadeId: { in: idsCompras } },
              { entidade: 'pagamento', entidadeId: { in: idsPagamentos } },
              { entidade: 'usuario', entidadeId: { in: idsUsuariosCriados } },
              {
                entidade: 'setor',
                entidadeId: setorMktId,
                usuarioId: felipeId,
              },
            ],
          },
        }),
        usuarios: await prisma.usuario.count({
          where: { id: { in: idsUsuariosCriados } },
        }),
      };
      expect(contagens).toEqual({
        solicitacoes: 0,
        orcamentos: 0,
        compras: 0,
        pagamentos: 0,
        aprovacoes: 0,
        documentos: 0,
        notificacoes: 0,
        auditoria: 0,
        usuarios: 0,
      });
      for (const nome of nomesArmazenados) {
        expect(existsSync(join(pastaUploads, nome))).toBe(false);
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('SOLICITANTE ana: cria/edita/cancela própria; criar orçamento; decisões, compra, NF, pagamento, auditoria e usuários → 403', async () => {
    const idFluxo = await criarSolicitacao(tokenAna, 'Matriz ana — fluxo base');
    const orcamentos: number[] = [];
    for (let indice = 0; indice < 3; indice += 1) {
      orcamentos.push(await criarOrcamento(tokenAna, idFluxo, indice));
    }

    const editada = await servidor()
      .patch(`/api/solicitacoes/${idFluxo}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ descricao: 'Matriz ana — descrição ajustada' })
      .expect(200);
    expect(editada.body.status).toBe('RASCUNHO');
    expect(editada.body.descricao).toBe('Matriz ana — descrição ajustada');

    await servidor()
      .post(`/api/solicitacoes/${idFluxo}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    const fluxo = { id: idFluxo, orcamentos };

    await decidir(tokenAna, fluxo.id, fluxo.orcamentos[0], 'APROVADO').expect(
      403,
    );
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/compra`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(403);
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/nf`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .attach('arquivo', PDF_NF, 'nf-matriz-ana.pdf')
      .expect(403);
    await pagar(tokenAna, 999999999).expect(403);
    await servidor()
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(403);
    await servidor()
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(403);

    const idCancelada = await criarSolicitacao(
      tokenAna,
      'Matriz ana — cancelamento próprio',
    );
    const cancelada = await servidor()
      .post(`/api/solicitacoes/${idCancelada}/cancelar`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ motivo: 'Desistência matriz' })
      .expect(200);
    expect(cancelada.body.status).toBe('CANCELADO');

    await servidor()
      .get(`/api/solicitacoes/${fluxo.id}`)
      .set('Authorization', `Bearer ${tokenSolicitante2}`)
      .expect(404);
  });

  it('GERENTE bruno: visualiza do setor (outro setor → 404); aprova nível 1; cancelar/pagar/auditoria → 403', async () => {
    fluxoOficina = await criarFluxoSubmetido(
      tokenSolicitanteOficina,
      'Matriz oficina — fluxo para 404 do gerente',
    );

    await servidor()
      .get(`/api/solicitacoes/${fluxoOficina.id}`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(404);

    const detalheProprio = await servidor()
      .get(`/api/solicitacoes/${idsSolicitacoes[0]}`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(200);
    expect(detalheProprio.body.id).toBe(idsSolicitacoes[0]);

    const aprovada = await decidir(
      tokenGerenteMkt,
      fluxoOficina.id,
      fluxoOficina.orcamentos[0],
      'APROVADO',
    ).expect(404);
    expect(aprovada.body.status).toBeUndefined();

    await servidor()
      .post(`/api/solicitacoes/${fluxoOficina.id}/cancelar`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ motivo: 'Gerente não cancela (DEC-014)' })
      .expect(403);
    await pagar(tokenGerenteMkt, 999999999).expect(403);
    await servidor()
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(403);
  });

  it('GF carla: visualiza todas (todos os setores — DEC-017); devolve 1º nível em OFICINA (DEC-019)', async () => {
    const oficinaId = fluxoOficina?.id ?? 0;

    const lista = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenGf}`)
      .expect(200);
    const ids = lista.body.map(
      (solicitacao: { id: number }) => solicitacao.id,
    );
    expect(ids).toContain(oficinaId);

    const detalheOficina = await servidor()
      .get(`/api/solicitacoes/${oficinaId}`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .expect(200);
    expect(detalheOficina.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');

    const devolvida = await servidor()
      .post(`/api/solicitacoes/${oficinaId}/devolver-correcao`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .send({ motivo: 'GF devolve 1º nível em OFICINA (DEC-019)' })
      .expect(200);
    expect(devolvida.body.status).toBe('AGUARDANDO_CORRECAO');
  });

  it('GF carla: aprova nível 2 em MKT → APROVADO; compra/NF/auditoria → 403; pagar após dados do TI (DEC-016)', async () => {
    const fluxo = await criarFluxoSubmetido(
      tokenAna,
      'Matriz ana — fluxo pagamento GF',
    );

    await decidir(
      tokenGerenteMkt,
      fluxo.id,
      fluxo.orcamentos[0],
      'APROVADO',
    ).expect(200);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe(
      'AGUARDANDO_APROVACAO_FINANCEIRA',
    );

    const aprovadaNivel2 = await decidir(
      tokenGf,
      fluxo.id,
      fluxo.orcamentos[1],
      'APROVADO',
    ).expect(200);
    expect(aprovadaNivel2.body.status).toBe('APROVADO');

    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/compra`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .expect(403);
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/nf`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .attach('arquivo', PDF_NF, 'nf-matriz-gf.pdf')
      .expect(403);
    await servidor()
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenGf}`)
      .expect(403);

    await levarAteAguardandoFinanceiro(fluxo);

    const respostaPagar = await pagar(tokenGf, idPagamentoPrincipal).expect(
      200,
    );
    const comprovante = respostaPagar.body.documento as {
      id: number;
      nomeArmazenado: string;
    };
    nomesArmazenados.push(comprovante.nomeArmazenado);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('PAGO');
  });

  it('TI davi: visualiza aprovadas (RASCUNHO alheio → 404); executa compra e dados de pagamento; pagar (RN-03)/aprovar → 403; anexa NF quando PAGO', async () => {
    const aprovadas = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    const ids = aprovadas.body.map(
      (solicitacao: { id: number }) => solicitacao.id,
    );
    expect(ids.length).toBeGreaterThanOrEqual(1);

    const idRascunho = await criarSolicitacao(
      tokenAna,
      'Matriz ana — rascunho para 404 do TI',
    );
    await servidor()
      .get(`/api/solicitacoes/${idRascunho}`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(404);

    const fluxo = await criarFluxoSubmetido(
      tokenAna,
      'Matriz ana — fluxo compra TI',
    );
    await decidir(
      tokenGerenteMkt,
      fluxo.id,
      fluxo.orcamentos[0],
      'APROVADO',
    ).expect(200);
    await decidir(tokenGf, fluxo.id, fluxo.orcamentos[1], 'APROVADO').expect(
      200,
    );

    const respostaCompra = await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/compra`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    const compraId = respostaCompra.body.id as number;
    idsCompras.push(compraId);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe(
      'COMPRA_EM_ANDAMENTO',
    );

    const respostaPagamento = await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({
        forma: 'BOLETO',
        dados: 'boleto 98765.4321 98765.4321 1 0987654321',
      })
      .expect(200);
    const pagamentoId = respostaPagamento.body.id as number;
    idsPagamentos.push(pagamentoId);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe(
      'AGUARDANDO_FINANCEIRO',
    );

    await pagar(tokenTi, pagamentoId).expect(403);
    await decidir(
      tokenTi,
      fluxo.id,
      fluxo.orcamentos[2],
      'APROVADO',
    ).expect(403);

    const respostaPagar = await pagar(tokenFinanceiro, pagamentoId).expect(
      200,
    );
    const comprovante = respostaPagar.body.documento as {
      id: number;
      nomeArmazenado: string;
    };
    nomesArmazenados.push(comprovante.nomeArmazenado);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('PAGO');

    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_NF, 'nf-matriz-ti.pdf')
      .expect(200);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('CONCLUIDO');
  });

  it('FINANCEIRO elisa: visualiza fase financeira; paga (DEC-016); aprovar/auditoria → 403', async () => {
    const fluxo = await criarFluxoSubmetido(
      tokenAna,
      'Matriz ana — fluxo pagamento FINANCEIRO',
    );
    await decidir(
      tokenGerenteMkt,
      fluxo.id,
      fluxo.orcamentos[0],
      'APROVADO',
    ).expect(200);
    await decidir(tokenGf, fluxo.id, fluxo.orcamentos[1], 'APROVADO').expect(
      200,
    );
    await levarAteAguardandoFinanceiro(fluxo);

    const lista = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenFinanceiro}`)
      .expect(200);
    const ids = lista.body.map(
      (solicitacao: { id: number }) => solicitacao.id,
    );
    expect(ids).toContain(fluxo.id);

    const pagamentoFluxo = idsPagamentos[idsPagamentos.length - 1];
    const respostaPagar = await pagar(tokenFinanceiro, pagamentoFluxo).expect(
      200,
    );
    const comprovante = respostaPagar.body.documento as {
      id: number;
      nomeArmazenado: string;
    };
    nomesArmazenados.push(comprovante.nomeArmazenado);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('PAGO');

    await decidir(
      tokenFinanceiro,
      fluxo.id,
      fluxo.orcamentos[2],
      'APROVADO',
    ).expect(403);
    await servidor()
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenFinanceiro}`)
      .expect(403);
  });

  it('ADMIN felipe: gerencia usuários/setores e lê auditoria; nada sobre o fluxo de solicitações → 403', async () => {
    const criado = await servidor()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: 'Matriz QA',
        email: EMAIL_USUARIO_ADMIN_CRIADO,
        senha: SENHA_TESTE,
        perfil: 'SOLICITANTE',
        setor: 'MKT',
      })
      .expect(201);
    idsUsuariosCriados.push(criado.body.id as number);
    expect(criado.body.email).toBe(EMAIL_USUARIO_ADMIN_CRIADO);

    const usuarios = await servidor()
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(Array.isArray(usuarios.body)).toBe(true);

    const setor = await servidor()
      .patch(`/api/setores/${setorMktId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nome: 'Marketing' })
      .expect(200);
    expect(setor.body.nome).toBe('Marketing');

    await servidor()
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const fluxo = await criarFluxoSubmetido(
      tokenSolicitante2,
      'Matriz solicitante 2 — fluxo para 403 do admin',
    );

    await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);
    await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ descricao: 'Admin não cria', itens: ITENS_PADRAO })
      .expect(403);
    await decidir(
      tokenAdmin,
      fluxo.id,
      fluxo.orcamentos[0],
      'APROVADO',
    ).expect(403);
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/compra`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ forma: 'BOLETO', dados: 'x' })
      .expect(403);
    await pagar(tokenAdmin, 999999999).expect(403);
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/nf`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .attach('arquivo', PDF_NF, 'nf-matriz-admin.pdf')
      .expect(403);
  });
});
