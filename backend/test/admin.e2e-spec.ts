import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { configureApp } from '../src/app.configuration.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const SENHA_DEV = 'SenhaDev123!';
const SENHA_NOVO = 'SenhaNova123!';
const SENHA_TROCADA = 'SenhaTrocada123!';
const EMAIL_ADMIN = 'felipe.cruz@compras.local';
const EMAIL_NAO_ADMIN = 'ana.souza@compras.local';
const EMAIL_NOVO = 'admin-criado@compras.teste';

interface RegistroAuditoriaApi {
  id: number;
  usuarioId: number;
  perfil: string;
  acao: string;
  entidade: string;
  entidadeId: number;
  estadoAnterior: string | null;
  estadoNovo: string | null;
  dados: unknown;
  createdAt: string;
  usuario: { nome: string; email: string };
}

describe('Admin (e2e) — gestão de usuários/setores, auditoria e OpenAPI', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let tokenAdmin = '';
  let tokenNaoAdmin = '';
  let novoUsuarioId = 0;
  let hashAnterior = '';
  let setorOficinaId = 0;
  let setorOficinaNomeOriginal = '';

  function servidor() {
    return request(app.getHttpServer());
  }

  async function obterToken(email: string): Promise<string> {
    const resposta = await servidor()
      .post('/api/auth/login')
      .send({ email, senha: SENHA_DEV });
    return resposta.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '::1');
    prisma = app.get(PrismaService);

    tokenAdmin = await obterToken(EMAIL_ADMIN);
    tokenNaoAdmin = await obterToken(EMAIL_NAO_ADMIN);

    const oficina = await prisma.setor.findUniqueOrThrow({
      where: { slug: 'OFICINA' },
    });
    setorOficinaId = oficina.id;
    setorOficinaNomeOriginal = oficina.nome;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.sessao.deleteMany({
        where: {
          usuario: {
            email: { in: [EMAIL_ADMIN, EMAIL_NAO_ADMIN, EMAIL_NOVO] },
          },
        },
      });
      if (novoUsuarioId > 0) {
        await prisma.auditoria.deleteMany({
          where: { entidade: 'usuario', entidadeId: novoUsuarioId },
        });
        await prisma.usuario.delete({ where: { id: novoUsuarioId } });
      }
      await prisma.auditoria.deleteMany({
        where: { entidade: 'setor', entidadeId: setorOficinaId },
      });
      if (setorOficinaId > 0) {
        await prisma.setor.update({
          where: { id: setorOficinaId },
          data: { nome: setorOficinaNomeOriginal },
        });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('1. admin cria usuário → 201 com argon2id no banco, sem senha na resposta; login do novo usuário funciona', async () => {
    const resposta = await servidor()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        nome: 'Usuário Criado pelo Admin',
        email: EMAIL_NOVO,
        senha: SENHA_NOVO,
        perfil: 'SOLICITANTE',
        setor: 'MKT',
      })
      .expect(201);

    novoUsuarioId = resposta.body.id as number;
    expect(resposta.body.email).toBe(EMAIL_NOVO);
    expect(resposta.body.perfil).toMatchObject({ slug: 'SOLICITANTE' });
    expect(resposta.body.setor).toMatchObject({ slug: 'MKT' });
    expect(JSON.stringify(resposta.body)).not.toContain('senhaHash');
    expect(JSON.stringify(resposta.body)).not.toContain(SENHA_NOVO);

    const noBanco = await prisma.usuario.findUniqueOrThrow({
      where: { id: novoUsuarioId },
    });
    expect(noBanco.senhaHash).toMatch(/^\$argon2id\$/);
    expect(noBanco.senhaHash).not.toBe(SENHA_NOVO);
    hashAnterior = noBanco.senhaHash;

    const loginNovo = await servidor()
      .post('/api/auth/login')
      .send({ email: EMAIL_NOVO, senha: SENHA_NOVO })
      .expect(200);

    expect(typeof loginNovo.body.accessToken).toBe('string');
  });

  it('2. e-mail duplicado → 409; perfil inválido → 400; senha curta → 400', async () => {
    const corpoBase = {
      nome: 'Outro Usuário',
      email: 'duplicado@compras.teste',
      senha: SENHA_NOVO,
      perfil: 'SOLICITANTE',
      setor: 'MKT',
    };

    const duplicado = await servidor()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...corpoBase, email: EMAIL_NOVO })
      .expect(409);

    expect(duplicado.body.message).toBe('E-mail já cadastrado');

    await servidor()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...corpoBase, perfil: 'PERFIL_INEXISTENTE' })
      .expect(400);

    await servidor()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...corpoBase, setor: 'SETOR_INEXISTENTE' })
      .expect(400);

    await servidor()
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ ...corpoBase, senha: 'curta' })
      .expect(400);
  });

  it('3. PATCH sem senha mantém o hash; com senha gera novo hash ≠ antigo; resposta sem senhaHash; auditoria CORRIGIR sem valor de senha', async () => {
    const renomeado = await servidor()
      .patch(`/api/usuarios/${novoUsuarioId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nome: 'Usuário Renomeado', setor: 'TI' })
      .expect(200);

    expect(renomeado.body.nome).toBe('Usuário Renomeado');
    expect(renomeado.body.setor).toMatchObject({ slug: 'TI' });
    expect(JSON.stringify(renomeado.body)).not.toContain('senhaHash');

    const aposRenomear = await prisma.usuario.findUniqueOrThrow({
      where: { id: novoUsuarioId },
    });
    expect(aposRenomear.senhaHash).toBe(hashAnterior);

    const comSenha = await servidor()
      .patch(`/api/usuarios/${novoUsuarioId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ senha: SENHA_TROCADA })
      .expect(200);

    expect(JSON.stringify(comSenha.body)).not.toContain('senhaHash');
    expect(JSON.stringify(comSenha.body)).not.toContain(SENHA_TROCADA);

    const aposTrocar = await prisma.usuario.findUniqueOrThrow({
      where: { id: novoUsuarioId },
    });
    expect(aposTrocar.senhaHash).toMatch(/^\$argon2id\$/);
    expect(aposTrocar.senhaHash).not.toBe(hashAnterior);

    const loginNovo = await servidor()
      .post('/api/auth/login')
      .send({ email: EMAIL_NOVO, senha: SENHA_TROCADA })
      .expect(200);
    expect(typeof loginNovo.body.accessToken).toBe('string');

    const registrosCorrigir = await prisma.auditoria.findMany({
      where: { entidade: 'usuario', entidadeId: novoUsuarioId, acao: 'CORRIGIR' },
    });
    expect(registrosCorrigir).toHaveLength(2);
    expect(
      registrosCorrigir.flatMap((r) =>
        (r.dados as { camposAlterados: string[] }).camposAlterados,
      ),
    ).toEqual(expect.arrayContaining(['nome', 'setor', 'senha']));
    expect(JSON.stringify(registrosCorrigir)).not.toContain(SENHA_TROCADA);
    expect(JSON.stringify(registrosCorrigir)).not.toContain(hashAnterior);
  });

  it('4. GET usuarios (admin) lista sem senhaHash e com perfil/setor; não-admin → 403 em todas as rotas admin', async () => {
    const lista = await servidor()
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(Array.isArray(lista.body)).toBe(true);
    expect(lista.body.some((u: { email: string }) => u.email === EMAIL_NOVO)).toBe(true);
    expect(JSON.stringify(lista.body)).not.toContain('senhaHash');
    for (const usuario of lista.body) {
      expect(usuario.perfil).toHaveProperty('slug');
      expect(usuario.setor).toHaveProperty('slug');
    }

    const detalhe = await servidor()
      .get(`/api/usuarios/${novoUsuarioId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(JSON.stringify(detalhe.body)).not.toContain('senhaHash');

    const rotasAdmin: Array<[string, request.Test]> = [
      ['GET', servidor().get('/api/usuarios')],
      ['GET', servidor().get('/api/usuarios/1')],
      ['POST', servidor().post('/api/usuarios')],
      ['PATCH', servidor().patch('/api/usuarios/1')],
      ['GET', servidor().get('/api/setores')],
      ['POST', servidor().post('/api/setores')],
      ['PATCH', servidor().patch('/api/setores/1')],
      ['GET', servidor().get('/api/auditoria')],
    ];

    for (const [metodo, chamada] of rotasAdmin) {
      const resposta = await chamada
        .set('Authorization', `Bearer ${tokenNaoAdmin}`)
        .send({});
      expect({ metodo, status: resposta.status }).toEqual({
        metodo,
        status: 403,
      });
    }
  });

  it('5. GET /api/auditoria com filtros retorna o CRIAR do teste 1, com usuário, dados, ordenação DESC e limit', async () => {
    const resposta = await servidor()
      .get('/api/auditoria')
      .query({ entidade: 'usuario', entidadeId: novoUsuarioId })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const registros = resposta.body as RegistroAuditoriaApi[];
    expect(registros.length).toBeGreaterThanOrEqual(3);

    const criar = registros.find(
      (r) => r.acao === 'CRIAR' && r.entidade === 'usuario',
    );
    expect(criar).toBeDefined();
    expect(criar?.entidadeId).toBe(novoUsuarioId);
    expect(criar?.perfil).toBe('ADMINISTRADOR');
    expect(criar?.usuario).toEqual({ nome: 'Felipe Cruz', email: EMAIL_ADMIN });
    expect(criar).toHaveProperty('dados');
    expect(criar).toHaveProperty('createdAt');

    for (let i = 1; i < registros.length; i += 1) {
      expect(new Date(registros[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(registros[i].createdAt).getTime(),
      );
    }

    const limitada = await servidor()
      .get('/api/auditoria')
      .query({ entidade: 'usuario', entidadeId: novoUsuarioId, limit: 2 })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(limitada.body).toHaveLength(2);
    expect(limitada.body[0].createdAt).toBe(registros[0].createdAt);
  });

  it('6. admin em rota de fluxo (GET /api/solicitacoes) → 403 (default-deny)', async () => {
    await servidor()
      .get('/api/solicitacoes')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);
  });

  it('7. setores: slug duplicado → 409; slug inválido → 400; PATCH nome OK com auditoria CORRIGIR; CRIAR de usuário presente', async () => {
    await servidor()
      .post('/api/setores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ slug: 'OFICINA', nome: 'Oficina Duplicada' })
      .expect(409);

    await servidor()
      .post('/api/setores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ slug: 'SLUG_INVALIDO', nome: 'Setor Inválido' })
      .expect(400);

    const lista = await servidor()
      .get('/api/setores')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(
      (lista.body as Array<{ slug: string }>).some((s) => s.slug === 'OFICINA'),
    ).toBe(true);

    const atualizado = await servidor()
      .patch(`/api/setores/${setorOficinaId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nome: 'Oficina Teste Admin' })
      .expect(200);
    expect(atualizado.body.nome).toBe('Oficina Teste Admin');

    const corrigirSetor = await prisma.auditoria.findFirstOrThrow({
      where: { entidade: 'setor', entidadeId: setorOficinaId, acao: 'CORRIGIR' },
    });
    expect(corrigirSetor.dados).toEqual({ camposAlterados: ['nome'] });

    const criarUsuario = await prisma.auditoria.findFirstOrThrow({
      where: { entidade: 'usuario', entidadeId: novoUsuarioId, acao: 'CRIAR' },
    });
    expect(criarUsuario.usuarioId).toBeGreaterThan(0);
  });

  it('8. /api/docs-json responde 200 com todos os endpoints e BearerAuth declarado', async () => {
    const resposta = await servidor().get('/api/docs-json').expect(200);

    const pacote = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };

    expect(resposta.body.info.title).toBe('Sistema de Compras API');
    expect(resposta.body.info.version).toBe(pacote.version);
    expect(resposta.body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });

    const caminhos = Object.keys(resposta.body.paths);
    for (const caminho of [
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/solicitacoes',
      '/api/solicitacoes/{id}',
      '/api/solicitacoes/{id}/orcamentos',
      '/api/solicitacoes/{id}/submeter',
      '/api/solicitacoes/{id}/decisao',
      '/api/solicitacoes/{id}/devolver-correcao',
      '/api/solicitacoes/{id}/cancelar',
      '/api/solicitacoes/{id}/compra',
      '/api/solicitacoes/{id}/pagamento-dados',
      '/api/solicitacoes/{id}/nf',
      '/api/pagamentos/{id}/pagar',
      '/api/documentos/{id}/download',
      '/api/notificacoes',
      '/api/usuarios',
      '/api/usuarios/{id}',
      '/api/setores',
      '/api/setores/{id}',
      '/api/auditoria',
      '/api/health',
    ]) {
      expect(caminhos).toContain(caminho);
    }

    const pagar = resposta.body.paths['/api/pagamentos/{id}/pagar'].post;
    expect(pagar.requestBody.content['multipart/form-data']).toBeDefined();

    const nf = resposta.body.paths['/api/solicitacoes/{id}/nf'].post;
    expect(nf.requestBody.content['multipart/form-data']).toBeDefined();
    expect(nf.security).toEqual([{ bearer: [] }]);

    expect(resposta.body.paths['/api/auth/login'].post.security).toBeUndefined();

    await servidor().get('/api/docs').expect(200);
  });
});
