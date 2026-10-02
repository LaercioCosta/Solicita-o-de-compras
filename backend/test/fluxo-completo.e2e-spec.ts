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
import { SlaService } from '../src/sla/sla.service.js';

const SENHA_DEV = 'SenhaDev123!';
const SENHA_TESTE = 'SenhaTeste123!';
const EMAIL_SOLICITANTE = 'ana.souza@compras.local';
const EMAIL_SOLICITANTE_2 = 'segundo.solicitante@fluxo.teste';
const EMAIL_SOLICITANTE_OFICINA = 'solicitante.oficina@fluxo.teste';
const EMAIL_GERENTE_MKT = 'bruno.lima@compras.local';
const EMAIL_GERENTE_COMERCIAL = 'gabriela.norte@compras.local';
const EMAIL_GF = 'carla.mendes@compras.local';
const EMAIL_TI = 'davi.costa@compras.local';
const EMAIL_FINANCEIRO = 'elisa.rae@compras.local';

const ITENS_PADRAO = [
  { produto: 'Notebook', quantidade: 2, valorUnitarioEstimado: 3500 },
];

const PDF_COMPROVANTE = Buffer.from(
  '%PDF-1.4\ncomprovante fluxo completo\n%%EOF',
);
const PDF_NF = Buffer.from('%PDF-1.4\nnota fiscal fluxo completo\n%%EOF');

const pastaUploads = fileURLToPath(new URL('../uploads/', import.meta.url));
const UM_DIA_MS = 24 * 60 * 60 * 1000;

interface Fluxo {
  id: number;
  orcamentos: number[];
}

describe('Fluxo completo (e2e) — TASK-045: devolução, RN-07(b), download e SLA', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let anaId = 0;
  let brunoId = 0;
  let carlaId = 0;
  let setorMktId = 0;
  let setorOficinaId = 0;
  let tokenAna = '';
  let tokenSolicitante2 = '';
  let tokenSolicitanteOficina = '';
  let tokenGerenteMkt = '';
  let tokenGerenteComercial = '';
  let tokenGf = '';
  let tokenTi = '';
  let tokenFinanceiro = '';
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
        linkLoja: `https://loja${indice}.example.com.br/fluxo`,
        cnpjLoja: '12345678000190',
        valor: 200 + indice,
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
    await submeter(token, id).expect(200);
    return { id, orcamentos };
  }

  function submeter(token: string, idSolicitacao: number) {
    return servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/submeter`)
      .set('Authorization', `Bearer ${token}`);
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

  function devolver(token: string, idSolicitacao: number, motivo: string) {
    return servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/devolver-correcao`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo });
  }

  function patchSolicitacao(
    token: string,
    idSolicitacao: number,
    dados: object,
  ) {
    return servidor()
      .patch(`/api/solicitacoes/${idSolicitacao}`)
      .set('Authorization', `Bearer ${token}`)
      .send(dados);
  }

  function patchOrcamento(
    token: string,
    idSolicitacao: number,
    orcamentoId: number,
    dados: object,
  ) {
    return servidor()
      .patch(`/api/solicitacoes/${idSolicitacao}/orcamentos/${orcamentoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(dados);
  }

  function baixarDocumento(token: string, idDocumento: number) {
    return servidor()
      .get(`/api/documentos/${idDocumento}/download`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((resposta, callback) => {
        const partes: Buffer[] = [];
        resposta.on('data', (parte: Buffer) => partes.push(parte));
        resposta.on('end', () => callback(null, Buffer.concat(partes)));
      });
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

  async function levarAtePago(descricao: string): Promise<{
    fluxo: Fluxo;
    comprovanteId: number;
  }> {
    const fluxo = await criarFluxoSubmetido(tokenAna, descricao);
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

    const respostaPagamento = await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({
        forma: 'BOLETO',
        dados: 'boleto 12345.6789 12345.6789 1 2345678901',
      })
      .expect(200);
    const pagamentoId = respostaPagamento.body.id as number;
    idsPagamentos.push(pagamentoId);

    const respostaPagar = await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '1500.00')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante-fluxo.pdf')
      .expect(200);
    const comprovante = respostaPagar.body.documento as {
      id: number;
      nomeArmazenado: string;
    };
    nomesArmazenados.push(comprovante.nomeArmazenado);

    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('PAGO');

    return { fluxo, comprovanteId: comprovante.id };
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
    const setorOficina = await prisma.setor.findUniqueOrThrow({
      where: { slug: 'OFICINA' },
    });
    setorMktId = setorMkt.id;
    setorOficinaId = setorOficina.id;

    const perfilSolicitante = await prisma.perfil.findUniqueOrThrow({
      where: { slug: 'SOLICITANTE' },
    });

    const senhaHash = await hash(SENHA_TESTE);
    for (const [nome, email, setorId] of [
      ['Segundo Solicitante', EMAIL_SOLICITANTE_2, setorMktId],
      ['Solicitante Oficina', EMAIL_SOLICITANTE_OFICINA, setorOficinaId],
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

    const ana = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_SOLICITANTE },
    });
    anaId = ana.id;
    const bruno = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_GERENTE_MKT },
    });
    brunoId = bruno.id;
    const carla = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_GF },
    });
    carlaId = carla.id;

    tokenAna = await obterToken(EMAIL_SOLICITANTE, SENHA_DEV);
    tokenSolicitante2 = await obterToken(EMAIL_SOLICITANTE_2, SENHA_TESTE);
    tokenSolicitanteOficina = await obterToken(
      EMAIL_SOLICITANTE_OFICINA,
      SENHA_TESTE,
    );
    tokenGerenteMkt = await obterToken(EMAIL_GERENTE_MKT, SENHA_DEV);
    tokenGerenteComercial = await obterToken(
      EMAIL_GERENTE_COMERCIAL,
      SENHA_DEV,
    );
    tokenGf = await obterToken(EMAIL_GF, SENHA_DEV);
    tokenTi = await obterToken(EMAIL_TI, SENHA_DEV);
    tokenFinanceiro = await obterToken(EMAIL_FINANCEIRO, SENHA_DEV);
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
              { usuarioId: { in: idsUsuariosCriados } },
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
          where: { id: { in: idsOrcamentos } },
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
              { usuarioId: { in: idsUsuariosCriados } },
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

  it('1. gerente devolve para correção → AGUARDANDO_CORRECAO com auditoria; perfis sem permissão → 403/404; não é decisão (CA-07)', async () => {
    const fluxo = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo devolução correção',
    );

    await devolver(tokenAna, fluxo.id, 'Sem permissão').expect(403);
    await devolver(tokenTi, fluxo.id, 'Sem permissão').expect(403);
    await devolver(tokenFinanceiro, fluxo.id, 'Sem permissão').expect(403);
    await devolver(tokenGerenteComercial, fluxo.id, 'Outro setor').expect(404);

    const resposta = await devolver(
      tokenGerenteMkt,
      fluxo.id,
      'Ajustar o valor do item 2',
    ).expect(200);

    expect(resposta.body.status).toBe('AGUARDANDO_CORRECAO');
    expect(resposta.body.cicloAprovacao).toBe(1);

    const registro = await prisma.auditoria.findFirstOrThrow({
      where: {
        entidade: 'solicitacao',
        entidadeId: fluxo.id,
        acao: 'CORRIGIR',
      },
    });
    expect(registro.usuarioId).toBe(brunoId);
    expect(registro.perfil).toBe('GERENTE');
    expect(registro.estadoAnterior).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(registro.estadoNovo).toBe('AGUARDANDO_CORRECAO');
    expect(registro.dados).toMatchObject({
      etapa: 'devolucao_correcao',
      motivo: 'Ajustar o valor do item 2',
    });

    expect(
      await prisma.aprovacao.count({ where: { solicitacaoId: fluxo.id } }),
    ).toBe(0);

    await decidir(
      tokenGerenteMkt,
      fluxo.id,
      fluxo.orcamentos[0],
      'APROVADO',
    ).expect(409);
    await decidir(tokenGf, fluxo.id, fluxo.orcamentos[1], 'APROVADO').expect(
      409,
    );
    await devolver(tokenGerenteMkt, fluxo.id, 'Devolver de novo').expect(409);

    const fluxoOficina = await criarFluxoSubmetido(
      tokenSolicitanteOficina,
      'Fluxo oficina devolução GF',
    );
    const respostaOficina = await devolver(
      tokenGf,
      fluxoOficina.id,
      'Ajustar itens da oficina',
    ).expect(200);
    expect(respostaOficina.body.status).toBe('AGUARDANDO_CORRECAO');
  });

  it('2. solicitante edita em AGUARDANDO_CORRECAO e ressubmete → ciclo INALTERADO (CA-07.2)', async () => {
    const fluxo = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo ressubmissão pós-correção',
    );
    await devolver(tokenGerenteMkt, fluxo.id, 'Corrigir a descrição').expect(
      200,
    );

    const editada = await patchSolicitacao(tokenAna, fluxo.id, {
      descricao: 'Descrição corrigida',
    }).expect(200);
    expect(editada.body.status).toBe('AGUARDANDO_CORRECAO');
    expect(editada.body.cicloAprovacao).toBe(1);
    expect(editada.body.descricao).toBe('Descrição corrigida');

    const submetida = await submeter(tokenAna, fluxo.id).expect(200);
    expect(submetida.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(submetida.body.cicloAprovacao).toBe(1);

    const noBanco = await prisma.solicitacao.findUniqueOrThrow({
      where: { id: fluxo.id },
    });
    expect(noBanco.cicloAprovacao).toBe(1);
  });

  it('3. RN-07(b) via PATCH da solicitação: reabertura ciclo++ e re-aprovação completa (CA-13)', async () => {
    const fluxo = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo RN-07b solicitação',
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
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('APROVADO');

    await patchSolicitacao(tokenSolicitante2, fluxo.id, {
      descricao: 'Tentativa alheia',
    }).expect(404);
    await patchSolicitacao(tokenGerenteMkt, fluxo.id, {
      descricao: 'Gerente não edita',
    }).expect(403);

    const resposta = await patchSolicitacao(tokenAna, fluxo.id, {
      descricao: 'Descrição alterada pós-aprovação',
    }).expect(200);
    expect(resposta.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(resposta.body.cicloAprovacao).toBe(2);
    expect(resposta.body.descricao).toBe('Descrição alterada pós-aprovação');

    const reabertura = await prisma.auditoria.findFirstOrThrow({
      where: {
        entidade: 'solicitacao',
        entidadeId: fluxo.id,
        acao: 'CORRIGIR',
      },
      orderBy: { id: 'desc' },
    });
    expect(reabertura.usuarioId).toBe(anaId);
    expect(reabertura.estadoAnterior).toBe('APROVADO');
    expect(reabertura.estadoNovo).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(reabertura.dados).toMatchObject({
      etapa: 'reabertura_aprovacao',
      cicloNovo: 2,
      camposAlterados: ['descricao'],
    });

    await decidir(
      tokenGerenteMkt,
      fluxo.id,
      fluxo.orcamentos[0],
      'APROVADO',
    ).expect(200);
    const reAprovada = await decidir(
      tokenGf,
      fluxo.id,
      fluxo.orcamentos[1],
      'APROVADO',
    ).expect(200);
    expect(reAprovada.body.status).toBe('APROVADO');
    expect(reAprovada.body.cicloAprovacao).toBe(2);

    const aprovacoes = await prisma.aprovacao.findMany({
      where: { solicitacaoId: fluxo.id },
    });
    expect(aprovacoes).toHaveLength(4);
    expect(
      aprovacoes.filter((aprovacao) => aprovacao.cicloAprovacao === 1),
    ).toHaveLength(2);
    expect(
      aprovacoes.filter((aprovacao) => aprovacao.cicloAprovacao === 2),
    ).toHaveLength(2);
  });

  it('4. RN-07(b) via orçamento: reabre o ciclo (CA-13); edição livre em AGUARDANDO_CORRECAO; terminais → 409 (RN-07(c))', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Fluxo RN-07b orçamento');
    const outra = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo dono do orçamento alheio',
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

    await patchOrcamento(tokenAna, fluxo.id, fluxo.orcamentos[0], {}).expect(
      400,
    );
    await patchOrcamento(tokenAna, fluxo.id, fluxo.orcamentos[0], {
      valor: -5,
    }).expect(400);
    await patchOrcamento(tokenAna, fluxo.id, outra.orcamentos[0], {
      valor: 10,
    }).expect(404);
    await patchOrcamento(tokenGf, fluxo.id, fluxo.orcamentos[0], {
      valor: 10,
    }).expect(403);

    const resposta = await patchOrcamento(
      tokenAna,
      fluxo.id,
      fluxo.orcamentos[0],
      {
        valor: 999.99,
      },
    ).expect(200);
    expect(Number(resposta.body.valor)).toBe(999.99);

    const detalhe = await servidor()
      .get(`/api/solicitacoes/${fluxo.id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(detalhe.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(detalhe.body.cicloAprovacao).toBe(2);

    const reabertura = await prisma.auditoria.findFirstOrThrow({
      where: {
        entidade: 'solicitacao',
        entidadeId: fluxo.id,
        acao: 'CORRIGIR',
      },
      orderBy: { id: 'desc' },
    });
    expect(reabertura.estadoAnterior).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');
    expect(reabertura.estadoNovo).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(reabertura.dados).toMatchObject({
      etapa: 'reabertura_aprovacao',
      cicloNovo: 2,
      camposAlterados: ['valor'],
    });

    await devolver(tokenGerenteComercial, fluxo.id, 'Outro setor').expect(404);
    await devolver(tokenGf, fluxo.id, 'GF não acumula em MKT').expect(404);
    const devolvida = await devolver(
      tokenGerenteMkt,
      fluxo.id,
      'Conferir o novo valor',
    ).expect(200);
    expect(devolvida.body.status).toBe('AGUARDANDO_CORRECAO');

    const livre = await patchOrcamento(
      tokenAna,
      fluxo.id,
      fluxo.orcamentos[0],
      {
        valor: 888.88,
      },
    ).expect(200);
    expect(Number(livre.body.valor)).toBe(888.88);

    const detalheAposLivre = await servidor()
      .get(`/api/solicitacoes/${fluxo.id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(detalheAposLivre.body.status).toBe('AGUARDANDO_CORRECAO');
    expect(detalheAposLivre.body.cicloAprovacao).toBe(2);

    const reprovada = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo reprovado terminal',
    );
    await decidir(
      tokenGerenteMkt,
      reprovada.id,
      reprovada.orcamentos[0],
      'REPROVADO',
    ).expect(200);
    await patchSolicitacao(tokenAna, reprovada.id, { descricao: 'x' }).expect(
      409,
    );
    await patchOrcamento(tokenAna, reprovada.id, reprovada.orcamentos[0], {
      valor: 10,
    }).expect(409);

    const idCancelada = await criarSolicitacao(
      tokenAna,
      'Fluxo cancelado terminal',
    );
    await servidor()
      .post(`/api/solicitacoes/${idCancelada}/cancelar`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ motivo: 'Desistência' })
      .expect(200);
    await patchSolicitacao(tokenAna, idCancelada, { descricao: 'x' }).expect(
      409,
    );
  });

  it('4b. DEC-027: edição bloqueada a partir de COMPRA_EM_ANDAMENTO (solicitação e orçamento → 409)', async () => {
    const fluxo = await criarFluxoSubmetido(tokenAna, 'Fluxo DEC-027 compra');
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
    idsCompras.push(respostaCompra.body.id as number);

    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('COMPRA_EM_ANDAMENTO');

    await patchSolicitacao(tokenAna, fluxo.id, {
      descricao: 'tentativa pós-compra',
    }).expect(409);
    await patchOrcamento(tokenAna, fluxo.id, fluxo.orcamentos[0], {
      valor: 123.45,
    }).expect(409);
    expect(await statusViaGet(tokenAna, fluxo.id)).toBe('COMPRA_EM_ANDAMENTO');
  });

  it('5. download com policy de envolvimento por perfil (RN-12/DEC-018); CONCLUIDO é terminal (RN-07(c))', async () => {
    const { fluxo: fluxoX, comprovanteId } = await levarAtePago(
      'Fluxo X download conclusão',
    );

    const respostaNf = await servidor()
      .post(`/api/solicitacoes/${fluxoX.id}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal-fluxo.pdf')
      .expect(200);
    const nfId = respostaNf.body.id as number;
    nomesArmazenados.push(respostaNf.body.nomeArmazenado as string);
    expect(await statusViaGet(tokenAna, fluxoX.id)).toBe('CONCLUIDO');

    const baixaDona = await baixarDocumento(tokenAna, comprovanteId).expect(
      200,
    );
    expect(Buffer.compare(baixaDona.body as Buffer, PDF_COMPROVANTE)).toBe(0);
    expect(baixaDona.headers['content-type']).toContain('application/pdf');
    expect(baixaDona.headers['content-disposition']).toContain('attachment');
    expect(baixaDona.headers['content-disposition']).toContain(
      'comprovante-fluxo.pdf',
    );

    await baixarDocumento(tokenSolicitante2, comprovanteId).expect(404);
    await baixarDocumento(tokenGerenteComercial, comprovanteId).expect(404);
    await baixarDocumento(tokenGerenteMkt, comprovanteId).expect(200);
    await baixarDocumento(tokenGf, comprovanteId).expect(200);
    await baixarDocumento(tokenFinanceiro, comprovanteId).expect(200);

    const baixaNfTi = await baixarDocumento(tokenTi, nfId).expect(200);
    expect(Buffer.compare(baixaNfTi.body as Buffer, PDF_NF)).toBe(0);

    await patchSolicitacao(tokenAna, fluxoX.id, { descricao: 'x' }).expect(409);
    await patchOrcamento(tokenAna, fluxoX.id, fluxoX.orcamentos[0], {
      valor: 10,
    }).expect(409);

    const { fluxo: fluxoY, comprovanteId: comprovanteY } = await levarAtePago(
      'Fluxo Y download pós-pagamento (DEC-027)',
    );
    await baixarDocumento(tokenFinanceiro, comprovanteY).expect(200);

    await patchSolicitacao(tokenAna, fluxoY.id, {
      descricao: 'Alteração pós-pagamento',
    }).expect(409);
    expect(await statusViaGet(tokenAna, fluxoY.id)).toBe('PAGO');
    await patchOrcamento(tokenAna, fluxoY.id, fluxoY.orcamentos[0], {
      valor: 10,
    }).expect(409);

    await baixarDocumento(tokenFinanceiro, comprovanteY).expect(200);
    await baixarDocumento(tokenTi, comprovanteY).expect(200);
    await baixarDocumento(tokenAna, comprovanteY).expect(200);
    await baixarDocumento(tokenGerenteMkt, comprovanteY).expect(200);
  });

  it('6. SLA de lembrete (DEC-020): único lembrete ao aprovador pendente correto; dentro do prazo → nenhum', async () => {
    const sla = app.get(SlaService);

    const antigaSetor = await prisma.solicitacao.create({
      data: {
        descricao: 'SLA pendente setor antigo',
        status: 'AGUARDANDO_APROVACAO_SETOR',
        solicitanteId: anaId,
        setorId: setorMktId,
        updatedAt: new Date(Date.now() - 4 * UM_DIA_MS),
      },
    });
    idsSolicitacoes.push(antigaSetor.id);

    await sla.verificarPendentes();

    const mensagem = mensagemLembrete(antigaSetor.id, 'AGUARDANDO_APROVACAO_SETOR', antigaSetor.cicloAprovacao);
    const brunoNotificado = await prisma.notificacao.findFirst({
      where: { usuarioId: brunoId, solicitacaoId: antigaSetor.id },
    });
    expect(brunoNotificado?.mensagem).toBe(mensagem);
    expect(
      await prisma.notificacao.count({
        where: { usuarioId: carlaId, solicitacaoId: antigaSetor.id },
      }),
    ).toBe(0);

    await sla.verificarPendentes();
    expect(
      await prisma.notificacao.count({
        where: { solicitacaoId: antigaSetor.id },
      }),
    ).toBe(1);

    const recente = await prisma.solicitacao.create({
      data: {
        descricao: 'SLA pendente recente',
        status: 'AGUARDANDO_APROVACAO_SETOR',
        solicitanteId: anaId,
        setorId: setorMktId,
      },
    });
    idsSolicitacoes.push(recente.id);

    await sla.verificarPendentes();
    expect(
      await prisma.notificacao.count({ where: { solicitacaoId: recente.id } }),
    ).toBe(0);

    const antigaFinanceira = await prisma.solicitacao.create({
      data: {
        descricao: 'SLA pendente financeira antigo',
        status: 'AGUARDANDO_APROVACAO_FINANCEIRA',
        solicitanteId: anaId,
        setorId: setorMktId,
        updatedAt: new Date(Date.now() - 4 * UM_DIA_MS),
      },
    });
    idsSolicitacoes.push(antigaFinanceira.id);

    await sla.verificarPendentes();
    const carlaNotificada = await prisma.notificacao.findFirst({
      where: { usuarioId: carlaId, solicitacaoId: antigaFinanceira.id },
    });
    expect(carlaNotificada?.mensagem).toBe(
      mensagemLembrete(antigaFinanceira.id, 'AGUARDANDO_APROVACAO_FINANCEIRA', antigaFinanceira.cicloAprovacao),
    );
    expect(
      await prisma.notificacao.count({
        where: { usuarioId: brunoId, solicitacaoId: antigaFinanceira.id },
      }),
    ).toBe(0);

    const antigaOficina = await prisma.solicitacao.create({
      data: {
        descricao: 'SLA pendente oficina antigo',
        status: 'AGUARDANDO_APROVACAO_SETOR',
        solicitanteId: idsUsuariosCriados[1],
        setorId: setorOficinaId,
        updatedAt: new Date(Date.now() - 4 * UM_DIA_MS),
      },
    });
    idsSolicitacoes.push(antigaOficina.id);

    await sla.verificarPendentes();
    expect(
      await prisma.notificacao.count({
        where: { usuarioId: carlaId, solicitacaoId: antigaOficina.id },
      }),
    ).toBe(1);
    expect(
      await prisma.notificacao.count({
        where: { usuarioId: brunoId, solicitacaoId: antigaOficina.id },
      }),
    ).toBe(0);

    // Reabertura (ciclo 2): o novo aprovador pendente recebe o lembrete mesmo
    // existindo o lembrete do ciclo anterior (DEC-020 — revisão Fase 10 achado #6).
    const reaberta = await prisma.solicitacao.create({
      data: {
        descricao: 'SLA reaberta ciclo 2',
        status: 'AGUARDANDO_APROVACAO_SETOR',
        cicloAprovacao: 2,
        solicitanteId: anaId,
        setorId: setorMktId,
        updatedAt: new Date(Date.now() - 4 * UM_DIA_MS),
      },
    });
    idsSolicitacoes.push(reaberta.id);
    await prisma.notificacao.create({
      data: {
        usuarioId: brunoId,
        mensagem: mensagemLembrete(reaberta.id, 'AGUARDANDO_APROVACAO_SETOR', 1),
        solicitacaoId: reaberta.id,
      },
    });

    await sla.verificarPendentes();
    const lembretesCiclo2 = await prisma.notificacao.findMany({
      where: { usuarioId: brunoId, solicitacaoId: reaberta.id },
    });
    expect(lembretesCiclo2).toHaveLength(2);
    expect(lembretesCiclo2.map((n) => n.mensagem)).toContain(
      mensagemLembrete(reaberta.id, 'AGUARDANDO_APROVACAO_SETOR', 2),
    );
  });

  it('7. TASK-048: filtro por status refina o escopo do perfil sem ampliá-lo', async () => {
    const pendenteMkt = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo filtro status pendente MKT',
    );
    const pendenteOficina = await criarFluxoSubmetido(
      tokenSolicitanteOficina,
      'Fluxo filtro status pendente oficina',
    );
    const rascunhoMkt = await criarSolicitacao(
      tokenAna,
      'Fluxo filtro status rascunho',
    );

    const listaGerente = await servidor()
      .get('/api/solicitacoes')
      .query({ status: 'AGUARDANDO_APROVACAO_SETOR' })
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(200);
    const itensGerente = listaGerente.body as { id: number; status: string }[];
    const idsGerente = itensGerente.map((item) => item.id);
    expect(idsGerente).toContain(pendenteMkt.id);
    expect(idsGerente).not.toContain(pendenteOficina.id);
    expect(idsGerente).not.toContain(rascunhoMkt);
    for (const item of itensGerente) {
      expect(item.status).toBe('AGUARDANDO_APROVACAO_SETOR');
    }

    const listaSolicitante = await servidor()
      .get('/api/solicitacoes')
      .query({ status: 'AGUARDANDO_APROVACAO_SETOR' })
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    const idsSolicitante = (
      listaSolicitante.body as { id: number }[]
    ).map((item) => item.id);
    expect(idsSolicitante).toContain(pendenteMkt.id);
    expect(idsSolicitante).not.toContain(pendenteOficina.id);

    const reprovada = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo filtro status reprovado',
    );
    await decidir(
      tokenGerenteMkt,
      reprovada.id,
      reprovada.orcamentos[0],
      'REPROVADO',
    ).expect(200);

    const listaGf = await servidor()
      .get('/api/solicitacoes')
      .query({ status: 'REPROVADO' })
      .set('Authorization', `Bearer ${tokenGf}`)
      .expect(200);
    const itensGf = listaGf.body as { id: number; status: string }[];
    expect(itensGf.map((item) => item.id)).toContain(reprovada.id);
    for (const item of itensGf) {
      expect(item.status).toBe('REPROVADO');
    }

    const semFiltro = await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(200);
    const idsSemFiltro = (semFiltro.body as { id: number }[]).map(
      (item) => item.id,
    );
    expect(idsSemFiltro).toContain(pendenteMkt.id);
    expect(idsSemFiltro).toContain(rascunhoMkt);

    await servidor()
      .get('/api/solicitacoes')
      .query({ status: 'ESTADO_INVALIDO' })
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(400);
  });

  it('8. TASK-048: marcar notificação como lida é idempotente e privado ao dono', async () => {
    const fluxo = await criarFluxoSubmetido(
      tokenAna,
      'Fluxo marcação de notificação lida',
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

    const respostaLista = await servidor()
      .get('/api/notificacoes')
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    const doFluxo = (
      respostaLista.body as { id: number; solicitacaoId: number | null }[]
    ).filter((item) => item.solicitacaoId === fluxo.id);
    expect(doFluxo.length).toBeGreaterThanOrEqual(1);
    const idNotificacao = doFluxo[0].id;

    const respostaLida = await servidor()
      .post(`/api/notificacoes/${idNotificacao}/lida`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    expect(respostaLida.body.lida).toBe(true);
    expect(respostaLida.body.lidaEm).not.toBeNull();

    const respostaIdempotente = await servidor()
      .post(`/api/notificacoes/${idNotificacao}/lida`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    expect(respostaIdempotente.body.lida).toBe(true);
    expect(respostaIdempotente.body.lidaEm).toBe(respostaLida.body.lidaEm);

    await servidor()
      .post(`/api/notificacoes/${idNotificacao}/lida`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(404);

    await servidor()
      .post('/api/notificacoes/999999/lida')
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(404);
  });
});

function mensagemLembrete(
  idSolicitacao: number,
  status: 'AGUARDANDO_APROVACAO_SETOR' | 'AGUARDANDO_APROVACAO_FINANCEIRA',
  cicloAprovacao = 1,
): string {
  const nivel = status === 'AGUARDANDO_APROVACAO_SETOR' ? 'setor' : 'financeira';
  return `Lembrete: solicitação #${idSolicitacao} aguardando sua aprovação (${nivel}, ciclo ${cicloAprovacao})`;
}
