import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { configureApp } from '../src/app.configuration.js';
import { AppModule } from '../src/app.module.js';

describe('App (e2e) — prefixo /api e guards globais', () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '::1');
  });

  it('GET /api/health permanece público (sem token) e responde ok', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(resposta.body.status).toBe('ok');
    expect(typeof resposta.body.timestamp).toBe('string');
  });

  it('GET /api/ sem token responde 401 (JwtAuthGuard global)', () => {
    return request(app.getHttpServer()).get('/api/').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
