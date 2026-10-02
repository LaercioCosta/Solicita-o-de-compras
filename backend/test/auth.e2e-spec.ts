import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { configureApp } from '../src/app.configuration.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { JwtPayload } from '../src/auth/jwt-payload.js';
import { RequirePermissao } from '../src/auth/require-permissao.decorator.js';
import { JWT_REFRESH_SERVICE } from '../src/auth/jwt-refresh.js';

const SENHA_DEV = 'SenhaDev123!';
const EMAIL_SOLICITANTE = 'ana.souza@compras.local';
const EMAIL_GERENTE = 'bruno.lima@compras.local';
const MENSAGEM_401 = 'Credenciais inválidas';

@Controller('teste-guard')
class TesteGuardController {
  @Get('protegida')
  protegida(): { ok: boolean } {
    return { ok: true };
  }

  @Get('solicitacao-aprovar')
  @RequirePermissao('solicitacao', 'aprovar')
  exigirAprovacao(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({ controllers: [TesteGuardController] })
class TesteGuardModule {}

describe('Auth (e2e)', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, TesteGuardModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '::1');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.sessao.deleteMany({
        where: { usuario: { email: { in: [EMAIL_SOLICITANTE, EMAIL_GERENTE] } } },
      });
    }
    await app.close();
  });

  function login(email: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, senha: SENHA_DEV });
  }

  async function obterToken(email: string): Promise<string> {
    const resposta = await login(email).expect(200);
    return resposta.body.accessToken as string;
  }

  it('login correto → 200 com accessToken, refreshToken e usuário sem senhaHash', async () => {
    const resposta = await login(EMAIL_SOLICITANTE).expect(200);

    expect(typeof resposta.body.accessToken).toBe('string');
    expect(typeof resposta.body.refreshToken).toBe('string');
    expect(resposta.body.usuario).toEqual({
      id: expect.any(Number),
      nome: 'Ana Souza',
      email: EMAIL_SOLICITANTE,
      perfil: 'SOLICITANTE',
      setorId: expect.any(Number),
    });
    expect(JSON.stringify(resposta.body)).not.toContain('senhaHash');
  });

  it('accessToken é um JWT válido com payload mínimo e expiração de 15 min (DEC-008)', async () => {
    const resposta = await login(EMAIL_SOLICITANTE).expect(200);
    const jwtService = app.get(JwtService);
    const payload = (await jwtService.verifyAsync(
      resposta.body.accessToken,
    )) as JwtPayload & {
      iat: number;
      exp: number;
    };

    expect(payload.sub).toBe(resposta.body.usuario.id);
    expect(payload.email).toBe(EMAIL_SOLICITANTE);
    expect(payload.perfil).toBe('SOLICITANTE');
    expect(payload.setorId).toBe(resposta.body.usuario.setorId);
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it('refresh: JWT 7d com typ refresh; banco guarda apenas sha256 (DEC-008)', async () => {
    const resposta = await login(EMAIL_SOLICITANTE).expect(200);
    const refreshToken = resposta.body.refreshToken as string;
    const jwtRefreshService = app.get<JwtService>(JWT_REFRESH_SERVICE, {
      strict: false,
    });

    const payload = (await jwtRefreshService.verifyAsync(refreshToken)) as {
      sub: number;
      typ: string;
      iat: number;
      exp: number;
    };

    expect(payload.typ).toBe('refresh');
    expect(payload.sub).toBe(resposta.body.usuario.id);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);

    const hashEsperado = createHash('sha256').update(refreshToken).digest('hex');
    const sessao = await prisma.sessao.findUniqueOrThrow({
      where: { refreshTokenHash: hashEsperado },
    });

    expect(sessao.usuarioId).toBe(resposta.body.usuario.id);
    expect(sessao.refreshTokenHash).not.toBe(refreshToken);
    expect(sessao.revogadaEm).toBeNull();
    expect(sessao.expiraEm.getTime()).toBe(payload.exp * 1000);
  });

  it('refresh rotativo: devolve NOVO par; access antigo segue válido; refresh antigo → 401', async () => {
    const loginInicial = await login(EMAIL_SOLICITANTE).expect(200);
    const accessAntigo = loginInicial.body.accessToken as string;
    const refreshAntigo = loginInicial.body.refreshToken as string;

    const renovacao = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshAntigo })
      .expect(200);

    expect(Object.keys(renovacao.body).sort()).toEqual([
      'accessToken',
      'refreshToken',
    ]);
    expect(renovacao.body.refreshToken).not.toBe(refreshAntigo);

    await request(app.getHttpServer())
      .get('/api/teste-guard/protegida')
      .set('Authorization', `Bearer ${accessAntigo}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/teste-guard/protegida')
      .set('Authorization', `Bearer ${renovacao.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshAntigo })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: renovacao.body.refreshToken })
      .expect(200);
  });

  it('logout revoga a sessão do hash, é idempotente e exige autenticação', async () => {
    const loginInicial = await login(EMAIL_SOLICITANTE).expect(200);
    const accessToken = loginInicial.body.accessToken as string;
    const refreshToken = loginInicial.body.refreshToken as string;

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);
  });

  it('refresh com token forjado, com access token no lugar e body vazio → 401/401/400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'eyJhbGciOiJIUzI1NiJ9.forjado.assinatura' })
      .expect(401);

    const accessToken = await obterToken(EMAIL_SOLICITANTE);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: accessToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({})
      .expect(400);
  });

  it('novo login NÃO invalida sessões anteriores (múltiplos dispositivos)', async () => {
    const primeiroLogin = await login(EMAIL_SOLICITANTE).expect(200);

    await login(EMAIL_SOLICITANTE).expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: primeiroLogin.body.refreshToken })
      .expect(200);
  });

  it('senha errada → 401 com mensagem genérica', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: EMAIL_SOLICITANTE, senha: 'SenhaIncorreta123!' })
      .expect(401);

    expect(resposta.body.message).toBe(MENSAGEM_401);
  });

  it('usuário inexistente → 401 com a mesma mensagem genérica do que senha errada', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'inexistente@compras.local', senha: SENHA_DEV })
      .expect(401);

    expect(resposta.body.message).toBe(MENSAGEM_401);
  });

  it('body inválido → 400 (ValidationPipe: e-mail inválido)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nao-e-um-email', senha: SENHA_DEV })
      .expect(400);
  });

  it('campo fora do DTO → 400 (forbidNonWhitelisted)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: EMAIL_SOLICITANTE,
        senha: SENHA_DEV,
        campoExtra: 'qualquer',
      })
      .expect(400);
  });

  it('rota protegida sem token → 401', () => {
    return request(app.getHttpServer())
      .get('/api/teste-guard/protegida')
      .expect(401);
  });

  it('rota protegida com token inválido → 401', () => {
    return request(app.getHttpServer())
      .get('/api/teste-guard/protegida')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('SOLICITANTE em solicitacao.aprovar → 403 (default-deny pela tabela permissoes)', async () => {
    const token = await obterToken(EMAIL_SOLICITANTE);

    await request(app.getHttpServer())
      .get('/api/teste-guard/solicitacao-aprovar')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GERENTE em solicitacao.aprovar → 200 (linha permitida na matriz)', async () => {
    const token = await obterToken(EMAIL_GERENTE);

    const resposta = await request(app.getHttpServer())
      .get('/api/teste-guard/solicitacao-aprovar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resposta.body).toEqual({ ok: true });
  });
});
