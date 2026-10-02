import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureApp } from '../src/app.configuration.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const SENHA_DEV = 'SenhaDev123!';

const PDF_COMPROVANTE = Buffer.from('%PDF-1.4\ncomprovante caminhos-erro\n%%EOF');

const pastaUploads = fileURLToPath(new URL('../uploads/', import.meta.url));

describe('Caminhos de erro (e2e) — branches não cobertos dos módulos críticos', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let tokenAna = '';
  let tokenGerenteMkt = '';
  let tokenGf = '';
  let tokenTi = '';
  let tokenAdmin = '';
  const idsSolicitacoes: number[] = [];
  const idsOrcamentos: number[] = [];
  const idsCompras: number[] = [];
  const idsPagamentos: number[] = [];
  const nomesArmazenados: string[] = [];

  function servidor() {
    return request(app.getHttpServer());
  }

  async function obterToken(email: string, senha: string): Promise<string> {
    const resposta = await servidor().post('/api/auth/login').send({ email, senha });
    return resposta.body.accessToken as string;
  }

  async function criarFluxoSubmetido(descricao: string): Promise<{
    id: number;
    orcamentos: number[];
  }> {
    const criada = await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ descricao, itens: [{ produto: 'Item', quantidade: 1, valorUnitarioEstimado: 100 }] })
      .expect(201);
    const id = criada.body.id as number;
    idsSolicitacoes.push(id);

    const orcamentos: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const resposta = await servidor()
        .post(`/api/solicitacoes/${id}/orcamentos`)
        .set('Authorization', `Bearer ${tokenAna}`)
        .send({ linkLoja: `https://loja${i}.exemplo.com/p`, cnpjLoja: '12345678000199', valor: 100 + i })
        .expect(201);
      orcamentos.push(resposta.body.id as number);
      idsOrcamentos.push(resposta.body.id as number);
    }

    await servidor()
      .post(`/api/solicitacoes/${id}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    return { id, orcamentos };
  }

  async function aprovarNivel1(fluxo: { id: number; orcamentos: number[] }): Promise<void> {
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/decisao`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ orcamentoId: fluxo.orcamentos[0], decisao: 'APROVADO' })
      .expect(200);
  }

  async function aprovarNivel2(fluxo: { id: number; orcamentos: number[] }): Promise<void> {
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/decisao`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .send({ orcamentoId: fluxo.orcamentos[1], decisao: 'APROVADO' })
      .expect(200);
  }

  async function iniciarCompra(fluxo: { id: number }): Promise<number> {
    const resposta = await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/compra`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    const compraId = resposta.body.id as number;
    idsCompras.push(compraId);
    return compraId;
  }

  async function registrarDadosPagamento(fluxo: { id: number }): Promise<number> {
    const resposta = await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ forma: 'BOLETO', dados: 'boleto caminhos-erro' })
      .expect(200);
    const pagamentoId = resposta.body.id as number;
    idsPagamentos.push(pagamentoId);
    return pagamentoId;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '::1');
    prisma = app.get(PrismaService);

    tokenAna = await obterToken('ana.souza@compras.local', SENHA_DEV);
    tokenGerenteMkt = await obterToken('bruno.lima@compras.local', SENHA_DEV);
    tokenGf = await obterToken('carla.mendes@compras.local', SENHA_DEV);
    tokenTi = await obterToken('davi.costa@compras.local', SENHA_DEV);
    tokenAdmin = await obterToken('felipe.cruz@compras.local', SENHA_DEV);
  });

  afterAll(async () => {
    if (prisma) {
      const documentos = await prisma.documento.findMany({
        where: { OR: [{ compraId: { in: idsCompras } }, { pagamentoId: { in: idsPagamentos } }] },
      });
      for (const documento of documentos) {
        nomesArmazenados.push(documento.nomeArmazenado);
      }
      await prisma.documento.deleteMany({
        where: { OR: [{ compraId: { in: idsCompras } }, { pagamentoId: { in: idsPagamentos } }] },
      });
      await prisma.pagamento.deleteMany({ where: { id: { in: idsPagamentos } } });
      await prisma.compra.deleteMany({ where: { id: { in: idsCompras } } });
      await prisma.notificacao.deleteMany({ where: { solicitacaoId: { in: idsSolicitacoes } } });
      await prisma.aprovacao.deleteMany({ where: { solicitacaoId: { in: idsSolicitacoes } } });
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
      await prisma.orcamento.deleteMany({ where: { solicitacaoId: { in: idsSolicitacoes } } });
      await prisma.solicitacaoItem.deleteMany({ where: { solicitacaoId: { in: idsSolicitacoes } } });
      await prisma.solicitacao.deleteMany({ where: { id: { in: idsSolicitacoes } } });
      await prisma.sessao.deleteMany({});
      for (const nome of nomesArmazenados) {
        await unlink(join(pastaUploads, nome)).catch(() => undefined);
      }
      await prisma.$disconnect();
    }
    await app.close();
  });

  it('compra/pagamento-dados/nf com id inexistente → 404 (TI autenticada)', async () => {
    await servidor()
      .post('/api/solicitacoes/999999999/compra')
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(404);
    await servidor()
      .post('/api/solicitacoes/999999999/pagamento-dados')
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ forma: 'BOLETO', dados: 'x' })
      .expect(404);
    await servidor()
      .post('/api/solicitacoes/999999999/nf')
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_COMPROVANTE, 'nf-inexistente.pdf')
      .expect(404);
  });

  it('GF não registra dados de pagamento (policy TI-only) → 403; pagamento inexistente no pagar → 404', async () => {
    const fluxo = await criarFluxoSubmetido('caminhos-erro policy TI pagamento-dados');
    await aprovarNivel1(fluxo);
    await aprovarNivel2(fluxo);
    await iniciarCompra(fluxo);

    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .send({ forma: 'BOLETO', dados: 'tentativa da GF' })
      .expect(403);

    await servidor()
      .post('/api/pagamentos/999999999/pagar')
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '10.00')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante.pdf')
      .expect(404);
  });

  it('valorPago inválido → 400; mime incoerente com a extensão → 400; pagamento duplicado → 409', async () => {
    const fluxo = await criarFluxoSubmetido('caminhos-erro pagar validações');
    await aprovarNivel1(fluxo);
    await aprovarNivel2(fluxo);
    await iniciarCompra(fluxo);
    const pagamentoId = await registrarDadosPagamento(fluxo);

    // Fase 8/DEC-026 item 8: exe com extensão/MIME de pdf forjados → 400 (magic bytes)
    await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '10.00')
      .attach('arquivo', Buffer.from('MZ\u0090\u0000\u0003exe disfarçado'), {
        filename: 'comprovante.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', 'abc')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante.pdf')
      .expect(400);

    await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '10.00')
      .attach('arquivo', Buffer.from('conteudo png falso'), {
        filename: 'comprovante.pdf',
        contentType: 'image/png',
      })
      .expect(400);

    await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '10.00')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante.pdf')
      .expect(200);

    await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '10.00')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante-2.pdf')
      .expect(409);
  });

  it('NF por não-TI → 403; download de documento inexistente → 404; ADMIN não acessa documento → 404', async () => {
    const fluxo = await criarFluxoSubmetido('caminhos-erro nf e downloads');
    await aprovarNivel1(fluxo);
    await aprovarNivel2(fluxo);
    await iniciarCompra(fluxo);
    const pagamentoId = await registrarDadosPagamento(fluxo);

    const pago = await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '10.00')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante.pdf')
      .expect(200);
    const comprovanteId = pago.body.documento.id as number;

    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/nf`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .attach('arquivo', PDF_COMPROVANTE, 'nf.pdf')
      .expect(403);

    await servidor()
      .get('/api/documentos/999999999/download')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(404);

    await servidor()
      .get(`/api/documentos/${comprovanteId}/download`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);

    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_COMPROVANTE, 'nf.pdf')
      .expect(200);
  });
});
