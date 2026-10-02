import { hash } from '@node-rs/argon2';
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
const SENHA_TESTE = 'SenhaTeste123!';
const EMAIL_SOLICITANTE = 'ana.souza@compras.local';
const EMAIL_SOLICITANTE_2 = 'solicitante.documentos@compras.teste';
const EMAIL_GERENTE_MKT = 'bruno.lima@compras.local';
const EMAIL_GF = 'carla.mendes@compras.local';
const EMAIL_TI = 'davi.costa@compras.local';

const ITENS_PADRAO = [
  { produto: 'Cadeira ergonômica', quantidade: 1, valorUnitarioEstimado: 900 },
];

const PDF_ORCAMENTO = Buffer.from('%PDF-1.4\norcamento de teste\n%%EOF');
const PDF_SEGUNDO = Buffer.from('%PDF-1.4\nsegundo orcamento\n%%EOF');
const PDF_GRANDE = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
const EXE_MALICIOSO = Buffer.from('conteudo executavel de teste');

const UUID_PDF_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

const pastaUploads = fileURLToPath(new URL('../uploads/', import.meta.url));

interface Fluxo {
  id: number;
  orcamentos: number[];
}

describe('Documentos de orçamento (e2e) — upload do solicitante (RF-18/RN-07/DEC-027)', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let anaId = 0;
  let idUsuarioTeste = 0;
  let tokenAna = '';
  let tokenSolicitante2 = '';
  let tokenGerenteMkt = '';
  let tokenGf = '';
  let tokenTi = '';
  let fluxoAprovado: Fluxo;
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

  async function criarSolicitacaoRascunho(descricao: string): Promise<number> {
    const resposta = await servidor()
      .post('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ descricao, itens: ITENS_PADRAO })
      .expect(201);
    const id = resposta.body.id as number;
    idsSolicitacoes.push(id);
    return id;
  }

  async function criarOrcamento(idSolicitacao: number): Promise<number> {
    const resposta = await servidor()
      .post(`/api/solicitacoes/${idSolicitacao}/orcamentos`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({
        linkLoja: 'https://loja.example.com.br/orcamento',
        cnpjLoja: '12345678000190',
        valor: 250,
      })
      .expect(201);
    const id = resposta.body.id as number;
    idsOrcamentos.push(id);
    return id;
  }

  async function criarSolicitacaoSubmetida(descricao: string): Promise<Fluxo> {
    const id = await criarSolicitacaoRascunho(descricao);
    const orcamentos: number[] = [];

    for (let indice = 0; indice < 3; indice += 1) {
      orcamentos.push(await criarOrcamento(id));
    }

    await servidor()
      .post(`/api/solicitacoes/${id}/submeter`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);

    return { id, orcamentos };
  }

  function anexar(
    token: string,
    idSolicitacao: number,
    idOrcamento: number,
    conteudo: Buffer,
    nome: string,
  ) {
    return servidor()
      .post(
        `/api/solicitacoes/${idSolicitacao}/orcamentos/${idOrcamento}/documento`,
      )
      .set('Authorization', `Bearer ${token}`)
      .attach('arquivo', conteudo, nome);
  }

  async function aprovarAteFinanceira(fluxo: Fluxo): Promise<void> {
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/decisao`)
      .set('Authorization', `Bearer ${tokenGerenteMkt}`)
      .send({ orcamentoId: fluxo.orcamentos[0], decisao: 'APROVADO' })
      .expect(200);
    await servidor()
      .post(`/api/solicitacoes/${fluxo.id}/decisao`)
      .set('Authorization', `Bearer ${tokenGf}`)
      .send({ orcamentoId: fluxo.orcamentos[1], decisao: 'APROVADO' })
      .expect(200);
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

    const perfilSolicitante = await prisma.perfil.findUniqueOrThrow({
      where: { slug: 'SOLICITANTE' },
    });
    const setorMkt = await prisma.setor.findUniqueOrThrow({
      where: { slug: 'MKT' },
    });
    const usuarioTeste = await prisma.usuario.create({
      data: {
        nome: 'Solicitante Documentos',
        email: EMAIL_SOLICITANTE_2,
        senhaHash: await hash(SENHA_TESTE),
        perfilId: perfilSolicitante.id,
        setorId: setorMkt.id,
      },
    });
    idUsuarioTeste = usuarioTeste.id;

    tokenAna = await obterToken(EMAIL_SOLICITANTE, SENHA_DEV);
    tokenSolicitante2 = await obterToken(EMAIL_SOLICITANTE_2, SENHA_TESTE);
    tokenGerenteMkt = await obterToken(EMAIL_GERENTE_MKT, SENHA_DEV);
    tokenGf = await obterToken(EMAIL_GF, SENHA_DEV);
    tokenTi = await obterToken(EMAIL_TI, SENHA_DEV);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.sessao.deleteMany({});
      const whereDocumentos = { orcamentoId: { in: idsOrcamentos } };
      const documentos = await prisma.documento.findMany({
        where: whereDocumentos,
      });
      for (const documento of documentos) {
        await unlink(join(pastaUploads, documento.nomeArmazenado)).catch(
          () => undefined,
        );
      }
      await prisma.documento.deleteMany({ where: whereDocumentos });
      if (idsSolicitacoes.length > 0) {
        await prisma.notificacao.deleteMany({
          where: { solicitacaoId: { in: idsSolicitacoes } },
        });
        await prisma.auditoria.deleteMany({
          where: {
            OR: [
              { entidade: 'solicitacao', entidadeId: { in: idsSolicitacoes } },
              { entidade: 'orcamento', entidadeId: { in: idsOrcamentos } },
              { entidade: 'documento', entidadeId: { in: idsDocumentos } },
            ],
          },
        });
        await prisma.aprovacao.deleteMany({
          where: { solicitacaoId: { in: idsSolicitacoes } },
        });
        const whereCompras = { solicitacaoId: { in: idsSolicitacoes } };
        const compras = await prisma.compra.findMany({
          where: whereCompras,
          select: { id: true },
        });
        if (compras.length > 0) {
          await prisma.pagamento.deleteMany({
            where: { compraId: { in: compras.map((compra) => compra.id) } },
          });
        }
        await prisma.compra.deleteMany({ where: whereCompras });
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
      if (idUsuarioTeste > 0) {
        await prisma.auditoria.deleteMany({
          where: { usuarioId: idUsuarioTeste },
        });
        await prisma.usuario.delete({ where: { id: idUsuarioTeste } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('1. dono anexa PDF em RASCUNHO → 201; documento ORCAMENTO persistido e visível no detalhe (múltiplos permitidos)', async () => {
    const id = await criarSolicitacaoRascunho('Anexo em rascunho');
    const orcamentoId = await criarOrcamento(id);

    const resposta = await anexar(
      tokenAna,
      id,
      orcamentoId,
      PDF_ORCAMENTO,
      'orcamento-loja.pdf',
    ).expect(201);
    const documento = resposta.body as {
      id: number;
      tipo: string;
      orcamentoId: number;
      nomeOriginal: string;
      nomeArmazenado: string;
      mimeType: string;
      tamanhoBytes: number;
      hash: string;
      donoId: number;
    };
    idsDocumentos.push(documento.id);
    expect(documento.tipo).toBe('ORCAMENTO');
    expect(documento.orcamentoId).toBe(orcamentoId);
    expect(documento.nomeOriginal).toBe('orcamento-loja.pdf');
    expect(documento.nomeArmazenado).toMatch(UUID_PDF_REGEX);
    expect(documento.mimeType).toBe('application/pdf');
    expect(documento.tamanhoBytes).toBe(PDF_ORCAMENTO.length);
    expect(documento.hash).toBe(
      createHash('sha256').update(PDF_ORCAMENTO).digest('hex'),
    );
    expect(documento.donoId).toBe(anaId);

    const documentoBd = await prisma.documento.findFirstOrThrow({
      where: { orcamentoId },
    });
    expect(documentoBd.tipo).toBe('ORCAMENTO');
    expect(existsSync(join(pastaUploads, documentoBd.nomeArmazenado))).toBe(
      true,
    );

    const respostaSegundo = await anexar(
      tokenAna,
      id,
      orcamentoId,
      PDF_SEGUNDO,
      'orcamento-loja-2.pdf',
    ).expect(201);
    idsDocumentos.push((respostaSegundo.body as { id: number }).id);

    const detalhe = await servidor()
      .get(`/api/solicitacoes/${id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(detalhe.body.status).toBe('RASCUNHO');
    expect(detalhe.body.documentos).toHaveLength(2);
    expect(detalhe.body.documentos[0]).toMatchObject({
      id: documento.id,
      tipo: 'ORCAMENTO',
      orcamentoId,
    });

    const auditoriaDocumento = await prisma.auditoria.findFirstOrThrow({
      where: { entidade: 'documento', entidadeId: documento.id },
    });
    expect(auditoriaDocumento.acao).toBe('CORRIGIR');
    expect(auditoriaDocumento.dados).toMatchObject({
      orcamentoId,
      tipo: 'ORCAMENTO',
    });
  });

  it('2. não-dono → 404; TI → 403; nada é persistido', async () => {
    const id = await criarSolicitacaoRascunho('Anexos negados');
    const orcamentoId = await criarOrcamento(id);

    await anexar(
      tokenSolicitante2,
      id,
      orcamentoId,
      PDF_ORCAMENTO,
      'orcamento-alheio.pdf',
    ).expect(404);

    await anexar(
      tokenTi,
      id,
      orcamentoId,
      PDF_ORCAMENTO,
      'orcamento-ti.pdf',
    ).expect(403);

    const total = await prisma.documento.count({
      where: { orcamentoId },
    });
    expect(total).toBe(0);
  });

  it('3. anexo em APROVADO → 200 com reabertura (AGUARDANDO_APROVACAO_SETOR, ciclo 2)', async () => {
    fluxoAprovado = await criarSolicitacaoSubmetida('Anexo com reabertura');
    await aprovarAteFinanceira(fluxoAprovado);

    const detalheAprovado = await servidor()
      .get(`/api/solicitacoes/${fluxoAprovado.id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(detalheAprovado.body.status).toBe('APROVADO');
    expect(detalheAprovado.body.cicloAprovacao).toBe(1);

    const resposta = await anexar(
      tokenAna,
      fluxoAprovado.id,
      fluxoAprovado.orcamentos[2],
      PDF_ORCAMENTO,
      'orcamento-revisado.pdf',
    ).expect(200);
    idsDocumentos.push((resposta.body as { id: number }).id);

    const detalhe = await servidor()
      .get(`/api/solicitacoes/${fluxoAprovado.id}`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(detalhe.body.status).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(detalhe.body.cicloAprovacao).toBe(2);
    expect(detalhe.body.documentos).toHaveLength(1);

    const reabertura = await prisma.auditoria.findFirstOrThrow({
      where: {
        entidade: 'solicitacao',
        entidadeId: fluxoAprovado.id,
        acao: 'CORRIGIR',
      },
      orderBy: { id: 'desc' },
    });
    expect(reabertura.estadoAnterior).toBe('APROVADO');
    expect(reabertura.estadoNovo).toBe('AGUARDANDO_APROVACAO_SETOR');
    expect(reabertura.dados).toMatchObject({
      etapa: 'reabertura_aprovacao',
      cicloNovo: 2,
    });
  });

  it('4. anexo em COMPRA_EM_ANDAMENTO → 409 (DEC-027); nada é persistido', async () => {
    await aprovarAteFinanceira(fluxoAprovado);

    await servidor()
      .post(`/api/solicitacoes/${fluxoAprovado.id}/compra`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);

    const detalhe = await servidor()
      .get(`/api/solicitacoes/${fluxoAprovado.id}`)
      .set('Authorization', `Bearer ${tokenTi}`)
      .expect(200);
    expect(detalhe.body.status).toBe('COMPRA_EM_ANDAMENTO');

    const orcamentoId = fluxoAprovado.orcamentos[0];
    await anexar(
      tokenAna,
      fluxoAprovado.id,
      orcamentoId,
      PDF_ORCAMENTO,
      'orcamento-pos-compra.pdf',
    ).expect(409);

    const total = await prisma.documento.count({ where: { orcamentoId } });
    expect(total).toBe(0);
  });

  it('5. arquivo .exe → 400; >10MB → 400; conteúdo forjado (magic bytes) → 400; nada é persistido', async () => {
    const id = await criarSolicitacaoRascunho('Anexos invalidos');
    const orcamentoId = await criarOrcamento(id);

    await anexar(
      tokenAna,
      id,
      orcamentoId,
      EXE_MALICIOSO,
      'malicioso.exe',
    ).expect(400);

    await anexar(tokenAna, id, orcamentoId, PDF_GRANDE, 'grande.pdf').expect(
      400,
    );

    // Fase 8/DEC-026 item 8: exe disfarçado com extensão/MIME de pdf → 400
    await anexar(
      tokenAna,
      id,
      orcamentoId,
      Buffer.from('MZ\u0090\u0000\u0003exe disfarçado'),
      'disfarçado.pdf',
    ).expect(400);

    const total = await prisma.documento.count({ where: { orcamentoId } });
    expect(total).toBe(0);
  });

  it('6. orçamento de outra solicitação → 404', async () => {
    const idA = await criarSolicitacaoRascunho('Solicitacao A');
    const orcamentoA = await criarOrcamento(idA);
    const idB = await criarSolicitacaoRascunho('Solicitacao B');
    const orcamentoB = await criarOrcamento(idB);

    await anexar(
      tokenAna,
      idA,
      orcamentoB,
      PDF_ORCAMENTO,
      'orcamento-trocado.pdf',
    ).expect(404);

    const totalA = await prisma.documento.count({
      where: { orcamentoId: orcamentoA },
    });
    expect(totalA).toBe(0);
    const totalB = await prisma.documento.count({
      where: { orcamentoId: orcamentoB },
    });
    expect(totalB).toBe(0);
  });
});
