import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
const EMAIL_TI = 'davi.costa@compras.local';

const PDF_COMPROVANTE = Buffer.from('%PDF-1.4\ncomprovante do piloto\n%%EOF');
const PDF_NF = Buffer.from('%PDF-1.4\nnota fiscal do piloto\n%%EOF');

const pastaTmp = '/tmp/opencode';
const caminhoComprovante = join(pastaTmp, 'piloto-comprovante.pdf');
const pastaUploads = fileURLToPath(new URL('../uploads/', import.meta.url));

const UUID_PDF_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

interface NotificacaoResposta {
  id: number;
  mensagem: string;
  solicitacaoId: number | null;
  lida: boolean;
}

describe('Piloto (e2e) — gate Seção 14: fluxo completo RASCUNHO → CONCLUIDO com probes de permissão', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let anaId = 0;
  let daviId = 0;
  let carlaId = 0;
  let tokenAna = '';
  let tokenGerenteMkt = '';
  let tokenGf = '';
  let tokenTi = '';
  let solicitacaoId = 0;
  const idsOrcamentos: number[] = [];
  let orcamentoSetorId = 0;
  let orcamentoFinanceiraId = 0;
  let compraId = 0;
  let pagamentoId = 0;
  let comprovanteId = 0;
  let nfId = 0;
  const nomesArmazenados: string[] = [];

  function servidor() {
    return request(app.getHttpServer());
  }

  async function statusViaGet(token: string, id: number): Promise<string> {
    const resposta = await servidor()
      .get(`/api/solicitacoes/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return resposta.body.status as string;
  }

  async function notificacoesDavi(idSolicitacao: number) {
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

    tokenAna = await servidor()
      .post('/api/auth/login')
      .send({ email: EMAIL_SOLICITANTE, senha: SENHA_DEV })
      .then((resposta) => resposta.body.accessToken as string);
    tokenGerenteMkt = await servidor()
      .post('/api/auth/login')
      .send({ email: EMAIL_GERENTE_MKT, senha: SENHA_DEV })
      .then((resposta) => resposta.body.accessToken as string);
    tokenGf = await servidor()
      .post('/api/auth/login')
      .send({ email: EMAIL_GF, senha: SENHA_DEV })
      .then((resposta) => resposta.body.accessToken as string);
    tokenTi = await servidor()
      .post('/api/auth/login')
      .send({ email: EMAIL_TI, senha: SENHA_DEV })
      .then((resposta) => resposta.body.accessToken as string);

    mkdirSync(pastaTmp, { recursive: true });
    writeFileSync(caminhoComprovante, PDF_COMPROVANTE);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.sessao.deleteMany({});
      const documentos = await prisma.documento.findMany({
        where: {
          OR: [
            { compraId: { in: [compraId] } },
            { pagamentoId: { in: [pagamentoId] } },
          ],
        },
      });
      nomesArmazenados.push(
        ...documentos.map((documento) => documento.nomeArmazenado),
      );
      for (const nome of nomesArmazenados) {
        await unlink(join(pastaUploads, nome)).catch(() => undefined);
      }
      await prisma.documento.deleteMany({
        where: {
          OR: [
            { compraId: { in: [compraId] } },
            { pagamentoId: { in: [pagamentoId] } },
          ],
        },
      });
      await prisma.pagamento.deleteMany({ where: { id: pagamentoId } });
      await prisma.compra.deleteMany({ where: { id: compraId } });
      if (solicitacaoId > 0) {
        await prisma.notificacao.deleteMany({
          where: { solicitacaoId },
        });
        await prisma.auditoria.deleteMany({
          where: {
            OR: [
              { entidade: 'solicitacao', entidadeId: solicitacaoId },
              { entidade: 'orcamento', entidadeId: { in: idsOrcamentos } },
              { entidade: 'compra', entidadeId: compraId },
              { entidade: 'pagamento', entidadeId: pagamentoId },
            ],
          },
        });
        await prisma.aprovacao.deleteMany({ where: { solicitacaoId } });
        await prisma.orcamento.deleteMany({
          where: { solicitacaoId },
        });
        await prisma.solicitacaoItem.deleteMany({ where: { solicitacaoId } });
        await prisma.solicitacao.deleteMany({ where: { id: solicitacaoId } });
      }

      const contagens = {
        solicitacoes: await prisma.solicitacao.count({
          where: { id: solicitacaoId },
        }),
        orcamentos: await prisma.orcamento.count({
          where: { id: { in: idsOrcamentos } },
        }),
        compras: await prisma.compra.count({ where: { id: compraId } }),
        pagamentos: await prisma.pagamento.count({
          where: { id: pagamentoId },
        }),
        aprovacoes: await prisma.aprovacao.count({
          where: { solicitacaoId },
        }),
        notificacoes: await prisma.notificacao.count({
          where: { solicitacaoId },
        }),
        auditoria: await prisma.auditoria.count({
          where: {
            OR: [
              { entidade: 'solicitacao', entidadeId: solicitacaoId },
              { entidade: 'orcamento', entidadeId: { in: idsOrcamentos } },
              { entidade: 'compra', entidadeId: compraId },
              { entidade: 'pagamento', entidadeId: pagamentoId },
            ],
          },
        }),
      };
      expect(contagens).toEqual({
        solicitacoes: 0,
        orcamentos: 0,
        compras: 0,
        pagamentos: 0,
        aprovacoes: 0,
        notificacoes: 0,
        auditoria: 0,
      });
      for (const nome of nomesArmazenados) {
        expect(existsSync(join(pastaUploads, nome))).toBe(false);
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('fluxo completo do piloto: criar → orçamentos → submeter → probes 403 → aprovações → compra → pagamento → comprovante → NF → CONCLUIDO', async () => {
    // Passo 1 — Solicitante loga e cria solicitação com ≥1 item → RASCUNHO (CA-01.1)
    const respostaCriacao = await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({
        descricao: 'Piloto — compra aprovada completa (Seção 14)',
        itens: [
          { produto: 'Notebook', quantidade: 2, valorUnitarioEstimado: 3500 },
        ],
      })
      .expect(201);
    solicitacaoId = respostaCriacao.body.id as number;
    expect(solicitacaoId).toBeGreaterThan(0);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe('RASCUNHO');

    // Passo 2 — 3 orçamentos com link da loja (CA-01.2, RN-01) → 3º orçamento criado
    for (let indice = 0; indice < 3; indice += 1) {
      const respostaOrcamento = await servidor()
        .post(`/api/solicitacoes/${solicitacaoId}/orcamentos`)
        .set('Authorization', `Bearer ${tokenAna}`)
        .send({
          linkLoja: `https://loja${indice}.example.com.br/piloto`,
          cnpjLoja: '12345678000190',
          valor: 6900 + indice,
        })
        .expect(201);
      const orcamentoId = respostaOrcamento.body.id as number;
      idsOrcamentos.push(orcamentoId);
      if (indice === 0) orcamentoSetorId = orcamentoId;
      if (indice === 2) {
        orcamentoFinanceiraId = orcamentoId;
        expect(orcamentoId).toBeGreaterThan(0);
        expect(respostaOrcamento.body.linkLoja).toBe(
          'https://loja2.example.com.br/piloto',
        );
      }
    }
    expect(idsOrcamentos).toHaveLength(3);

    // Passo 3 — Submete → AGUARDANDO_APROVACAO_SETOR (CA-01.4)
    await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe(
      'AGUARDANDO_APROVACAO_SETOR',
    );

    // Passo 4 — PROBE NEGATIVO: solicitante e TI tentam decidir → 403 (CA-02.6)
    await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/decisao`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ orcamentoId: orcamentoSetorId, decisao: 'APROVADO' })
      .expect(403);
    await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/decisao`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ orcamentoId: orcamentoSetorId, decisao: 'APROVADO' })
      .expect(403);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe(
      'AGUARDANDO_APROVACAO_SETOR',
    );

    // Passo 5 — Gerente do setor aprova vinculando orçamento (CA-02.2, RN-06) → AGUARDANDO_APROVACAO_FINANCEIRA (CA-02.3)
    await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/decisao`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ orcamentoId: orcamentoSetorId, decisao: 'APROVADO' })
      .expect(200);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe(
      'AGUARDANDO_APROVACAO_FINANCEIRA',
    );

    // Passo 6 — PROBE: TI verifica /api/notificacoes → ZERO notificações (CA-03.5)
    expect((await notificacoesDavi(solicitacaoId)).length).toBe(0);

    // Passo 7 — Gerente Financeira aprova vinculando orçamento (RN-06) → APROVADO (CA-03.3)
    await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/decisao`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .send({ orcamentoId: orcamentoFinanceiraId, decisao: 'APROVADO' })
      .expect(200);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe('APROVADO');

    // Passo 8 — TI verifica /api/notificacoes → ≥1 notificação citando a solicitação (RN-02)
    const notificacoesAprovacao = await notificacoesDavi(solicitacaoId);
    expect(notificacoesAprovacao.length).toBeGreaterThanOrEqual(1);
    expect(notificacoesAprovacao[0].mensagem).toContain(`#${solicitacaoId}`);
    expect(notificacoesAprovacao[0].lida).toBe(false);

    // Passo 9 — PROBE: gerente tenta executar compra → 403; TI inicia a compra → COMPRA_EM_ANDAMENTO (CA-04.2); vínculo com orçamento da aprovação financeira (CA-04.3/RN-03)
    await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/compra`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .expect(403);

    const respostaCompra = await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/compra`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    const compra = respostaCompra.body as {
      id: number;
      solicitacaoId: number;
      orcamentoId: number;
      executanteId: number;
    };
    compraId = compra.id;
    expect(compra.solicitacaoId).toBe(solicitacaoId);
    expect(compra.executanteId).toBe(daviId);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe(
      'COMPRA_EM_ANDAMENTO',
    );

    const compraBd = await prisma.compra.findUniqueOrThrow({
      where: { id: compraId },
    });
    expect(compraBd.orcamentoId).toBe(orcamentoFinanceiraId);
    expect(compraBd.orcamentoId).not.toBe(orcamentoSetorId);

    // Passo 10 — TI registra dados de pagamento (BOLETO) → AGUARDANDO_FINANCEIRO (CA-05.1, 05.2)
    const dadosBoleto =
      'boleto piloto 12345.67891 12345.67892 12345.67893 1 2345678901';
    const respostaPagamento = await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/pagamento-dados`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .send({ forma: 'BOLETO', dados: dadosBoleto })
      .expect(200);
    const pagamento = respostaPagamento.body as { id: number };
    pagamentoId = pagamento.id;
    expect(pagamentoId).toBeGreaterThan(0);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe(
      'AGUARDANDO_FINANCEIRO',
    );

    // Passo 11 — PROBE: TI tenta pagar → 403 (CA-04.4); GF paga com comprovante → PAGO (CA-05.4); Documento COMPROVANTE_PAGAMENTO criado (CA-05.5)
    await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .field('valorPago', '7000')
      .attach('arquivo', PDF_COMPROVANTE, 'comprovante-ti.pdf')
      .expect(403);

    const respostaPgto = await servidor()
      .post(`/api/pagamentos/${pagamentoId}/pagar`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .field('valorPago', '7000.00')
      .attach('arquivo', caminhoComprovante, 'comprovante-piloto.pdf')
      .expect(200);
    const documentoComprovante = respostaPgto.body.documento as {
      id: number;
      tipo: string;
      nomeArmazenado: string;
      hash: string;
    };
    comprovanteId = documentoComprovante.id;
    expect(documentoComprovante.tipo).toBe('COMPROVANTE_PAGAMENTO');
    expect(documentoComprovante.nomeArmazenado).toMatch(UUID_PDF_REGEX);
    expect(documentoComprovante.hash).toBe(
      createHash('sha256').update(PDF_COMPROVANTE).digest('hex'),
    );
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe('PAGO');
    const comprovanteBd = await prisma.documento.findUniqueOrThrow({
      where: { id: comprovanteId },
    });
    expect(comprovanteBd.compraId).toBe(compraId);
    expect(comprovanteBd.pagamentoId).toBe(pagamentoId);
    nomesArmazenados.push(comprovanteBd.nomeArmazenado);
    expect(existsSync(join(pastaUploads, comprovanteBd.nomeArmazenado))).toBe(
      true,
    );

    // Passo 12 — PROBE: tentar concluir SEM NF → não é possível; rota de NF exige multipart; estado só sai de PAGO via anexo de NF (CA-06.1)
    await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(400);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe('PAGO');

    // Passo 13 — TI anexa NF (multipart) → CONCLUIDO (CA-06.2)
    const respostaNf = await servidor()
      .post(`/api/solicitacoes/${solicitacaoId}/nf`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .attach('arquivo', PDF_NF, 'nota-fiscal-piloto.pdf')
      .expect(200);
    const documentoNf = respostaNf.body as {
      id: number;
      tipo: string;
      nomeArmazenado: string;
    };
    nfId = documentoNf.id;
    expect(documentoNf.tipo).toBe('NOTA_FISCAL');
    expect(documentoNf.nomeArmazenado).toMatch(UUID_PDF_REGEX);
    expect(await statusViaGet(tokenAna, solicitacaoId)).toBe('CONCLUIDO');
    const nfBd = await prisma.documento.findUniqueOrThrow({
      where: { id: nfId },
    });
    expect(nfBd.compraId).toBe(compraId);
    expect(nfBd.donoId).toBe(daviId);
    nomesArmazenados.push(nfBd.nomeArmazenado);
    expect(existsSync(join(pastaUploads, nfBd.nomeArmazenado))).toBe(true);
  });

  it('verificações finais via prisma: persistência, auditoria ordenada, aprovações RN-06, status CONCLUIDO', async () => {
    // Passo 14a — Persistência completa
    const solicitacaoBd = await prisma.solicitacao.findUniqueOrThrow({
      where: { id: solicitacaoId },
      include: {
        orcamentos: true,
        itens: true,
        compra: true,
        aprovacoes: true,
      },
    });
    expect(solicitacaoBd.orcamentos).toHaveLength(3);
    expect(solicitacaoBd.itens).toHaveLength(1);
    expect(solicitacaoBd.compra?.id).toBe(compraId);
    const pagamentoBd = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
    });
    expect(pagamentoBd.compraId).toBe(compraId);
    expect(pagamentoBd.forma).toBe('BOLETO');
    expect(pagamentoBd.pagoPorId).toBe(carlaId);
    const documentosBd = await prisma.documento.findMany({
      where: { compraId },
    });
    expect(documentosBd).toHaveLength(2);
    expect(documentosBd.map((documento) => documento.tipo).sort()).toEqual([
      'COMPROVANTE_PAGAMENTO',
      'NOTA_FISCAL',
    ]);

    // Passo 14b — Auditoria do fluxo, EM ORDEM (CA-09.1)
    const registros = await prisma.auditoria.findMany({
      where: {
        OR: [
          { entidade: 'solicitacao', entidadeId: solicitacaoId },
          { entidade: 'compra', entidadeId: compraId },
          { entidade: 'pagamento', entidadeId: pagamentoId },
        ],
      },
      orderBy: { id: 'asc' },
    });
    const sequencia = registros.map((registro) => ({
      acao: registro.acao,
      entidade: registro.entidade,
    }));
    expect(sequencia).toEqual([
      { acao: 'CRIAR', entidade: 'solicitacao' },
      { acao: 'SUBMETER', entidade: 'solicitacao' },
      { acao: 'APROVAR', entidade: 'solicitacao' },
      { acao: 'APROVAR', entidade: 'solicitacao' },
      { acao: 'COMPRAR', entidade: 'compra' },
      { acao: 'COMPRAR', entidade: 'pagamento' },
      { acao: 'PAGAR', entidade: 'pagamento' },
      { acao: 'CONCLUIR', entidade: 'solicitacao' },
    ]);
    const [
      criar,
      submeter,
      aprovarSetor,
      aprovarFinanceira,
      comprar,
      enviarPagamento,
      pagar,
      concluir,
    ] = registros;
    expect(criar.usuarioId).toBe(anaId);
    expect(criar.perfil).toBe('SOLICITANTE');
    expect(criar.estadoNovo).toBe('RASCUNHO');
    expect(submeter.usuarioId).toBe(anaId);
    expect(submeter.estadoAnterior).toBe('RASCUNHO');
    expect(submeter.estadoNovo).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(aprovarSetor.usuarioId).not.toBe(anaId);
    expect(aprovarSetor.perfil).toBe('GERENTE');
    expect(aprovarSetor.estadoAnterior).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(aprovarSetor.estadoNovo).toBe('AGUARDANDO_APROVACAO_FINANCEIRA');
    expect(aprovarSetor.dados).toMatchObject({
      orcamentoId: orcamentoSetorId,
    });
    expect(aprovarFinanceira.usuarioId).toBe(carlaId);
    expect(aprovarFinanceira.perfil).toBe('GERENTE_FINANCEIRA');
    expect(aprovarFinanceira.estadoAnterior).toBe(
      'AGUARDANDO_APROVACAO_FINANCEIRA',
    );
    expect(aprovarFinanceira.estadoNovo).toBe('APROVADO');
    expect(aprovarFinanceira.dados).toMatchObject({
      orcamentoId: orcamentoFinanceiraId,
    });
    expect(comprar.usuarioId).toBe(daviId);
    expect(comprar.perfil).toBe('TI');
    expect(comprar.estadoAnterior).toBe('APROVADO');
    expect(comprar.estadoNovo).toBe('COMPRA_EM_ANDAMENTO');
    expect(enviarPagamento.usuarioId).toBe(daviId);
    expect(enviarPagamento.estadoAnterior).toBe('COMPRA_EM_ANDAMENTO');
    expect(enviarPagamento.estadoNovo).toBe('AGUARDANDO_FINANCEIRO');
    expect(enviarPagamento.dados).toMatchObject({
      etapa: 'envio_pagamento',
      forma: 'BOLETO',
      solicitacaoId,
    });
    expect(pagar.usuarioId).toBe(carlaId);
    expect(pagar.perfil).toBe('GERENTE_FINANCEIRA');
    expect(pagar.estadoAnterior).toBe('AGUARDANDO_FINANCEIRO');
    expect(pagar.estadoNovo).toBe('PAGO');
    expect(pagar.dados).toMatchObject({
      pagamentoId,
      documentoId: comprovanteId,
    });
    expect(concluir.usuarioId).toBe(daviId);
    expect(concluir.perfil).toBe('TI');
    expect(concluir.estadoAnterior).toBe('PAGO');
    expect(concluir.estadoNovo).toBe('CONCLUIDO');
    expect(concluir.dados).toMatchObject({ documentoNfId: nfId });

    // Passo 14c — Aprovações persistidas com orcamentoId não-nulo (RN-06), nível/ciclo corretos
    expect(solicitacaoBd.aprovacoes).toHaveLength(2);
    const aprovacaoSetor = solicitacaoBd.aprovacoes.find(
      (aprovacao) => aprovacao.nivel === 'SETOR',
    );
    const aprovacaoFinanceira = solicitacaoBd.aprovacoes.find(
      (aprovacao) => aprovacao.nivel === 'FINANCEIRA',
    );
    expect(aprovacaoSetor).toBeDefined();
    expect(aprovacaoFinanceira).toBeDefined();
    expect(aprovacaoSetor?.orcamentoId).not.toBeNull();
    expect(aprovacaoSetor?.orcamentoId).toBe(orcamentoSetorId);
    expect(aprovacaoFinanceira?.orcamentoId).not.toBeNull();
    expect(aprovacaoFinanceira?.orcamentoId).toBe(orcamentoFinanceiraId);
    expect(aprovacaoSetor?.cicloAprovacao).toBe(1);
    expect(aprovacaoFinanceira?.cicloAprovacao).toBe(1);

    // Passo 14d — Status final CONCLUIDO
    expect(solicitacaoBd.status).toBe('CONCLUIDO');
  });

  it('detalhe pós-pagamento expõe compra, pagamento derivado e documentos sem nomeArmazenado/hash', async () => {
    const pagamentoBd = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
    });
    const documentosBd = await prisma.documento.findMany({
      where: { compraId },
      orderBy: { id: 'asc' },
    });
    expect(documentosBd).toHaveLength(2);

    const resposta = await servidor()
      .get(`/api/solicitacoes/${solicitacaoId}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    const detalhe = resposta.body as {
      setor: { id: number; slug: string; nome: string };
      compra: { id: number; orcamentoId: number } | null;
      pagamento: {
        id: number;
        forma: string;
        dados: string;
        valorPago: string;
        pagoEm: string;
      } | null;
      documentos: Array<{
        id: number;
        tipo: string;
        nomeOriginal: string;
        mimeType: string;
        tamanhoBytes: number;
        orcamentoId: number | null;
        compraId: number | null;
        pagamentoId: number | null;
      }>;
    };

    expect(detalhe.setor).toMatchObject({
      slug: 'MKT',
      nome: 'Marketing',
    });
    expect(typeof detalhe.setor.id).toBe('number');
    expect(detalhe.compra).toEqual({
      id: compraId,
      orcamentoId: orcamentoFinanceiraId,
    });
    expect(detalhe.pagamento?.id).toBe(pagamentoId);
    expect(detalhe.pagamento?.forma).toBe('BOLETO');
    expect(detalhe.pagamento?.dados).toBe(pagamentoBd.dados);
    expect(Number(detalhe.pagamento?.valorPago)).toBe(7000);
    expect(detalhe.pagamento?.pagoEm).toBeTruthy();

    expect(detalhe.documentos).toHaveLength(2);
    expect(detalhe.documentos.map((documento) => documento.tipo).sort()).toEqual(
      ['COMPROVANTE_PAGAMENTO', 'NOTA_FISCAL'],
    );
    expect(detalhe.documentos.map((documento) => documento.id)).toEqual(
      documentosBd.map((documento) => documento.id),
    );
    for (const documento of detalhe.documentos) {
      expect(Object.keys(documento).sort()).toEqual([
        'compraId',
        'id',
        'mimeType',
        'nomeOriginal',
        'orcamentoId',
        'pagamentoId',
        'tamanhoBytes',
        'tipo',
      ]);
    }

    const payload = JSON.stringify(resposta.body);
    expect(payload).not.toContain('nomeArmazenado');
    expect(payload).not.toContain('"hash"');
    for (const documento of documentosBd) {
      expect(payload).not.toContain(documento.nomeArmazenado);
      expect(payload).not.toContain(documento.hash);
    }
  });
});
