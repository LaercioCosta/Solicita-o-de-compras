import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureApp } from '../src/app.configuration.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const SENHA_DEV = 'SenhaDev123!';
const EMAIL_SOLICITANTE = 'ana.souza@compras.local';
const EMAIL_GERENTE_MKT = 'bruno.lima@compras.local';
const EMAIL_GF = 'carla.mendes@compras.local';
const EMAIL_FINANCEIRO = 'elisa.rae@compras.local';
const EMAIL_TI = 'davi.costa@compras.local';

const ITENS_PADRAO = [
  { produto: 'Monitor 4K', quantidade: 1, valorUnitarioEstimado: 1800 },
];

const PDF_COMPROVANTE = Buffer.from('%PDF-1.4\ncomprovante de teste\n%%EOF');
const PDF_NF = Buffer.from('%PDF-1.4\nnota fiscal de teste\n%%EOF');
const PDF_GRANDE = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
const EXE_MALICIOSO = Buffer.from('conteudo executavel de teste');

const UUID_PDF_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

const pastaUploads = fileURLToPath(new URL('../uploads/', import.meta.url));

interface Fluxo {
  id: number;
  orcamentos: number[];
}

describe('Compras/Pagamentos/Documentos (e2e) — compra TI → pagamento → comprovante → NF → CONCLUIDO', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let anaId = 0;
  let daviId = 0;
  let carlaId = 0;
  let elisaId = 0;
  let setorMktId = 0;
  let tokenAna = '';
  let tokenGerenteMkt = '';
  let tokenGf = '';
  let tokenFinanceiro = '';
  let tokenTi = '';
  let fluxoA: Fluxo;
  let fluxoB: Fluxo;
  let compraAId = 0;
  let pagamentoAId = 0;
  const idsSolicitacoes: number[] = [];
  const idsOrcamentos: number[] = [];
  const idsCompras: number[] = [];
  const idsPagamentos: number[] = [];

  function servidor() {
    return request(app.getHttpServer());
  }

  async function obterToken(email: string, senha: string): Promise<string> {
    const resposta = await servidor()
      .post('/api/auth/login')
      .send({ email, senha });
    return resposta.body.accessToken as string;
  }

  async function criarSolicitacaoSubmetida(descricao: string): Promise<Fluxo> {
    const respostaCriacao = await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ descricao, itens: ITENS_PADRAO })
      .expect(201);
    const id = respostaCriacao.body.id as number;
    idsSolicitacoes.push(id);

    const orcamentos: number[] = [];
    for (let indice = 0; indice < 3; indice += 1) {
      const respostaOrcamento = await servidor()
        .post(`/api/solicitacoes/${id}/orcamentos`)
        .set('Authorization', `Bearer ${tokenAna}`)
        .send({
          linkLoja: `https://loja${indice}.example.com.br/orcamento`,
          cnpjLoja: '12345678000190',
          valor: 200 + indice,
        })
        .expect(201);
      const orcamentoId = respostaOrcamento.body.id as number;
      idsOrcamentos.push(orcamentoId);
      orcamentos.push(orcamentoId);
    }

    await servidor()
      .post(`/api/solicitacoes/${id}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    return { id, orcamentos };
  }

  async function aprovarNivelSetor(fluxo: Fluxo): Promise<void> {
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/decisao`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ orcamentoId: fluxo.orcamentos[0], decisao: 'APROVADO' })
      .expect(200);
  }

  async function aprovarNivelFinanceira(fluxo: Fluxo): Promise<void> {
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/decisao`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .send({ orcamentoId: fluxo.orcamentos[1], decisao: 'APROVADO' })
      .expect(200);
  }

  function executarCompra(token: string, idSolicitacao: number) {
    return servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/compra`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function statusViaGet(token: string, idSolicitacao: number): Promise<string> {
    const resposta = await servidor()
      .get(`/api/solicitacoes/${idSolicitacao}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return resposta.body.status as string;
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
    const ana = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_SOLICITANTE },
    });
    anaId = ana.id;
    const davi = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_TI },
    });
    daviId = davi.id;
    const carla = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_GF },
    });
    carlaId = carla.id;
    const elisa = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_FINANCEIRO },
    });
    elisaId = elisa.id;

    tokenAna = await obterToken(EMAIL_SOLICITANTE, SENHA_DEV);
    tokenGerenteMkt = await obterToken(EMAIL_GERENTE_MKT, SENHA_DEV);
    tokenGf = await obterToken(EMAIL_GF, SENHA_DEV);
    tokenFinanceiro = await obterToken(EMAIL_FINANCEIRO, SENHA_DEV);
    tokenTi = await obterToken(EMAIL_TI, SENHA_DEV);
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
      for (const documento of documentos) {
        await unlink(join(pastaUploads, documento.nomeArmazenado)).catch(
          () => undefined,
        );
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
    }
    if (app) {
      await app.close();
    }
  });

  it('11. TI compra → COMPRA_EM_ANDAMENTO com o orçamento da aprovação financeira; não-TI → 403; repetir/estado errado → 409', async () => {
    fluxoA = await criarSolicitacaoSubmetida('Fluxo A compra completa');
    await aprovarNivelSetor(fluxoA);
    await aprovarNivelFinanceira(fluxoA);

    await executarCompra(tokenAna, fluxoA.id).expect(403);
    await executarCompra(tokenGerenteMkt, fluxoA.id).expect(403);
    await executarCompra(tokenGf, fluxoA.id).expect(403);
    await executarCompra(tokenFinanceiro, fluxoA.id).expect(403);

    const resposta = await executarCompra(tokenTi, fluxoA.id).expect(200);
    const compra = resposta.body as {
      id: number;
      solicitacaoId: number;
      orcamentoId: number;
      executanteId: number;
    };
    compraAId = compra.id;
    idsCompras.push(compraAId);
    expect(compra.solicitacaoId).toBe(fluxoA.id);
    expect(compra.orcamentoId).toBe(fluxoA.orcamentos[1]);
    expect(compra.orcamentoId).not.toBe(fluxoA.orcamentos[0]);
    expect(compra.executanteId).toBe(daviId);

    expect(await statusViaGet(tokenAna, fluxoA.id)).toBe('COMPRA_EM_ANDAMENTO');

    const compraBd = await prisma.compra.findUniqueOrThrow({
      where: { solicitacaoId: fluxoA.id },
    });
    expect(compraBd.orcamentoId).toBe(fluxoA.orcamentos[1]);

    await executarCompra(tokenTi, fluxoA.id).expect(409);

    const fluxoUmNivel = await criarSolicitacaoSubmetida('Fluxo D um nível');
    await aprovarNivelSetor(fluxoUmNivel);
    expect(await statusViaGet(tokenAna, fluxoUmNivel.id)).toBe(
      'AGUARDANDO_APROVACAO_FINANCEIRA',
    );
    await executarCompra(tokenTi, fluxoUmNivel.id).expect(409);
  });

  it('12. TI registra dados de pagamento BOLETO → AGUARDANDO_FINANCEIRO; GF → 403; repetir → 409; forma inválida → 400', async () => {
    const dadosBoleto = 'boleto 12345.6789 12345.6789 1234.5678 901 1234567890';
    const resposta = await servidor()
      .post(`/api/solicitacoes/${fluxoA.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ forma: 'BOLETO', dados: dadosBoleto })
      .expect(200);
    const pagamento = resposta.body as {
      id: number;
      compraId: number;
      forma: string;
      dados: string;
      registradoPorId: number;
    };
    pagamentoAId = pagamento.id;
    idsPagamentos.push(pagamentoAId);
    expect(pagamento.forma).toBe('BOLETO');
    expect(pagamento.dados).toBe(dadosBoleto);
    expect(pagamento.registradoPorId).toBe(daviId);

    expect(await statusViaGet(tokenAna, fluxoA.id)).toBe('AGUARDANDO_FINANCEIRO');

    const pagamentoBd = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoAId },
    });
    expect(pagamentoBd.compraId).toBe(compraAId);
    expect(pagamentoBd.valorPago).toBeNull();
    expect(pagamentoBd.pagoPorId).toBeNull();

    await servidor()
      .post(`/api/solicitacoes/${fluxoA.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .send({ forma: 'PIX', dados: 'pix da GF' })
      .expect(403);

    await servidor()
      .post(`/api/solicitacoes/${fluxoA.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ forma: 'BOLETO', dados: 'segundo boleto' })
      .expect(409);

    await servidor()
      .post(`/api/solicitacoes/${fluxoA.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ forma: 'CARTAO', dados: 'cartao' })
      .expect(400);
  });

  it('13. GF paga com comprovante → PAGO; TI → 403; .exe → 400; >10MB → 400; FINANCEIRO paga (DEC-016)', async () => {
    const resposta = await servidor()
      .post(`/api/pagamentos/${pagamentoAId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '1234.50')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante.pdf')
      .expect(200);
    const corpo = resposta.body as {
      pagamento: { valorPago: string; pagoPorId: number; pagoEm: string };
      documento: {
        id: number;
        tipo: string;
        nomeOriginal: string;
        nomeArmazenado: string;
        hash: string;
        tamanhoBytes: number;
        mimeType: string;
      };
    };
    expect(Number(corpo.pagamento.valorPago)).toBe(1234.5);
    expect(corpo.pagamento.pagoPorId).toBe(carlaId);
    expect(corpo.pagamento.pagoEm).toBeTruthy();
    expect(corpo.documento.tipo).toBe('COMPROVANTE_PAGAMENTO');
    expect(corpo.documento.nomeOriginal).toBe('comprovante.pdf');
    expect(corpo.documento.nomeArmazenado).toMatch(UUID_PDF_REGEX);
    expect(corpo.documento.hash).toBe(
      createHash('sha256').update(PDF_COMPROVANTE).digest('hex'),
    );
    expect(corpo.documento.tamanhoBytes).toBe(PDF_COMPROVANTE.length);
    expect(corpo.documento.mimeType).toBe('application/pdf');

    expect(await statusViaGet(tokenAna, fluxoA.id)).toBe('PAGO');

    const pagamentoBd = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoAId },
    });
    expect(Number(pagamentoBd.valorPago)).toBe(1234.5);
    expect(pagamentoBd.pagoPorId).toBe(carlaId);
    expect(pagamentoBd.pagoEm).not.toBeNull();

    const documentoBd = await prisma.documento.findFirstOrThrow({
      where: { pagamentoId: pagamentoAId },
    });
    expect(documentoBd.tipo).toBe('COMPROVANTE_PAGAMENTO');
    expect(documentoBd.compraId).toBe(compraAId);
    expect(documentoBd.nomeArmazenado).toMatch(UUID_PDF_REGEX);
    expect(existsSync(join(pastaUploads, documentoBd.nomeArmazenado))).toBe(true);

    await servidor()
      .post(`/api/pagamentos/${pagamentoAId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '10')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante2.pdf')
      .expect(409);

    fluxoB = await criarSolicitacaoSubmetida('Fluxo B negativas do pagamento');
    await aprovarNivelSetor(fluxoB);
    await aprovarNivelFinanceira(fluxoB);
    const respostaCompraB = await executarCompra(tokenTi, fluxoB.id).expect(200);
    idsCompras.push((respostaCompraB.body as { id: number }).id);

    const respostaPagamentoB = await servidor()
      .post(`/api/solicitacoes/${fluxoB.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ forma: 'PIX', dados: 'pix copia-e-cola 00020126' })
      .expect(200);
    const pagamentoBId = respostaPagamentoB.body.id as number;
    idsPagamentos.push(pagamentoBId);

    await servidor()
      .post(`/api/pagamentos/${pagamentoBId}/pagar`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .field('valorPago', '100')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante.pdf')
      .expect(403);

    await servidor()
      .post(`/api/pagamentos/${pagamentoBId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '100')
      .attach('arquivo', EXE_MALICIOSO, 'malicioso.exe')
      .expect(400);

    await servidor()
      .post(`/api/pagamentos/${pagamentoBId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '100')
      .attach('arquivo', PDF_GRANDE, 'grande.pdf')
      .expect(400);

    await servidor()
      .post(`/api/pagamentos/${pagamentoBId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', 'abc')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante.pdf')
      .expect(400);

    await servidor()
      .post(`/api/pagamentos/${pagamentoBId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '100')
      .expect(400);

    const respostaElisa = await servidor()
      .post(`/api/pagamentos/${pagamentoBId}/pagar`)
      .set('Authorization', `Bearer ${tokenFinanceiro}`)
      .field('valorPago', '999.99')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante-elisa.pdf')
      .expect(200);
    expect(
      (respostaElisa.body.pagamento as { pagoPorId: number }).pagoPorId,
    ).toBe(elisaId);
    expect(await statusViaGet(tokenAna, fluxoB.id)).toBe('PAGO');
  });

  it('14. TI anexa NF → CONCLUIDO; repetir → 409; NF sem comprovante → 422; demais perfis → 403', async () => {
    await servidor()
      .post(`/api/solicitacoes/${fluxoB.id}/nf`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal.pdf')
      .expect(403);
    await servidor()
      .post(`/api/solicitacoes/${fluxoB.id}/nf`)
      .set('Authorization', `Bearer ${tokenFinanceiro}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal.pdf')
      .expect(403);
    await servidor()
      .post(`/api/solicitacoes/${fluxoB.id}/nf`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal.pdf')
      .expect(403);

    const resposta = await servidor()
      .post(`/api/solicitacoes/${fluxoA.id}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal.pdf')
      .expect(200);
    const documentoNf = resposta.body as {
      id: number;
      tipo: string;
      nomeArmazenado: string;
    };
    expect(documentoNf.tipo).toBe('NOTA_FISCAL');
    expect(documentoNf.nomeArmazenado).toMatch(UUID_PDF_REGEX);

    expect(await statusViaGet(tokenAna, fluxoA.id)).toBe('CONCLUIDO');

    const nfBd = await prisma.documento.findFirstOrThrow({
      where: { tipo: 'NOTA_FISCAL', compraId: compraAId },
    });
    expect(nfBd.donoId).toBe(daviId);

    await servidor()
      .post(`/api/solicitacoes/${fluxoA.id}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal-2.pdf')
      .expect(409);

    const solicitacaoC = await prisma.solicitacao.create({
      data: {
        descricao: 'Fluxo C pago sem comprovante',
        status: 'PAGO',
        solicitanteId: anaId,
        setorId: setorMktId,
      },
    });
    idsSolicitacoes.push(solicitacaoC.id);
    const orcamentoC = await prisma.orcamento.create({
      data: {
        solicitacaoId: solicitacaoC.id,
        linkLoja: 'https://loja.example.com.br/orcamento-c',
        cnpjLoja: '12345678000190',
        valor: 300,
      },
    });
    idsOrcamentos.push(orcamentoC.id);
    const compraC = await prisma.compra.create({
      data: {
        solicitacaoId: solicitacaoC.id,
        orcamentoId: orcamentoC.id,
        executanteId: daviId,
      },
    });
    idsCompras.push(compraC.id);
    const pagamentoC = await prisma.pagamento.create({
      data: {
        compraId: compraC.id,
        forma: 'BOLETO',
        dados: 'boleto do fluxo C',
        registradoPorId: daviId,
      },
    });
    idsPagamentos.push(pagamentoC.id);

    await servidor()
      .post(`/api/solicitacoes/${solicitacaoC.id}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal-c.pdf')
      .expect(422);
    expect(await statusViaGet(tokenAna, solicitacaoC.id)).toBe('PAGO');
  });

  it('15. auditoria completa do fluxo: APROVAR×2, COMPRAR×2, PAGAR, CONCLUIR com estados (CA-09)', async () => {
    const registrosSolicitacao = await prisma.auditoria.findMany({
      where: { entidade: 'solicitacao', entidadeId: fluxoA.id },
    });
    const aprovacoes = registrosSolicitacao.filter(
      (registro) => registro.acao === 'APROVAR',
    );
    expect(aprovacoes).toHaveLength(2);
    expect(
      [...aprovacoes]
        .map((registro) => registro.estadoNovo)
        .sort((a, b) => (a ?? '').localeCompare(b ?? '')),
    ).toEqual(['AGUARDANDO_APROVACAO_FINANCEIRA', 'APROVADO']);

    const auditoriaCompra = await prisma.auditoria.findMany({
      where: { entidade: 'compra', entidadeId: compraAId },
    });
    expect(auditoriaCompra).toHaveLength(1);
    expect(auditoriaCompra[0].acao).toBe('COMPRAR');
    expect(auditoriaCompra[0].estadoAnterior).toBe('APROVADO');
    expect(auditoriaCompra[0].estadoNovo).toBe('COMPRA_EM_ANDAMENTO');
    expect(auditoriaCompra[0].usuarioId).toBe(daviId);

    const auditoriaPagamento = await prisma.auditoria.findMany({
      where: { entidade: 'pagamento', entidadeId: pagamentoAId },
    });
    expect(auditoriaPagamento).toHaveLength(2);

    const envio = auditoriaPagamento.find(
      (registro) => registro.acao === 'COMPRAR',
    );
    expect(envio?.estadoAnterior).toBe('COMPRA_EM_ANDAMENTO');
    expect(envio?.estadoNovo).toBe('AGUARDANDO_FINANCEIRO');
    expect(envio?.dados).toMatchObject({
      etapa: 'envio_pagamento',
      forma: 'BOLETO',
      solicitacaoId: fluxoA.id,
    });

    const comprovante = await prisma.documento.findFirstOrThrow({
      where: { tipo: 'COMPROVANTE_PAGAMENTO', compraId: compraAId },
    });
    const pagar = auditoriaPagamento.find(
      (registro) => registro.acao === 'PAGAR',
    );
    expect(pagar?.usuarioId).toBe(carlaId);
    expect(pagar?.estadoAnterior).toBe('AGUARDANDO_FINANCEIRO');
    expect(pagar?.estadoNovo).toBe('PAGO');
    expect(pagar?.dados).toMatchObject({
      pagamentoId: pagamentoAId,
      valorPago: 1234.5,
      documentoId: comprovante.id,
    });

    const documentoNf = await prisma.documento.findFirstOrThrow({
      where: { tipo: 'NOTA_FISCAL', compraId: compraAId },
    });
    const concluir = registrosSolicitacao.find(
      (registro) => registro.acao === 'CONCLUIR',
    );
    expect(concluir?.usuarioId).toBe(daviId);
    expect(concluir?.estadoAnterior).toBe('PAGO');
    expect(concluir?.estadoNovo).toBe('CONCLUIDO');
    expect(concluir?.dados).toMatchObject({ documentoNfId: documentoNf.id });

    const totalComprar =
      auditoriaCompra.filter((registro) => registro.acao === 'COMPRAR').length +
      auditoriaPagamento.filter((registro) => registro.acao === 'COMPRAR')
        .length;
    expect(totalComprar).toBe(2);
  });
});
