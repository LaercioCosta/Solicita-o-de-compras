import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditoriaService } from '../src/auditoria/auditoria.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AppModule } from '../src/app.module.js';

const EMAIL_USUARIO_SEED = 'ana.souza@compras.local';

describe('AuditoriaService (integração) — RN-05/DEC-010', () => {
  let app: INestApplication;
  let auditoriaService: AuditoriaService;
  let prisma: PrismaService;
  let registroCriadoId: number | undefined;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    auditoriaService = app.get(AuditoriaService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (registroCriadoId) {
      await prisma.auditoria.deleteMany({ where: { id: registroCriadoId } });
    }
    await app.close();
  });

  it('registrar() grava quem, quando, ação e entidade na tabela auditoria', async () => {
    const ana = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_USUARIO_SEED },
    });

    const registro = await auditoriaService.registrar({
      usuarioId: ana.id,
      perfil: 'SOLICITANTE',
      acao: 'CRIAR',
      entidade: 'auditoria-spec',
      entidadeId: ana.id,
      estadoAnterior: 'ANTIGO',
      estadoNovo: 'NOVO',
      dados: { origem: 'teste' },
    });
    registroCriadoId = registro.id;

    const salvo = await prisma.auditoria.findUniqueOrThrow({
      where: { id: registro.id },
    });
    expect(salvo.usuarioId).toBe(ana.id);
    expect(salvo.perfil).toBe('SOLICITANTE');
    expect(salvo.acao).toBe('CRIAR');
    expect(salvo.entidade).toBe('auditoria-spec');
    expect(salvo.entidadeId).toBe(ana.id);
    expect(salvo.estadoAnterior).toBe('ANTIGO');
    expect(salvo.estadoNovo).toBe('NOVO');
    expect(salvo.dados).toEqual({ origem: 'teste' });
    expect(salvo.createdAt).toBeInstanceOf(Date);
  });

  it('serviço é append-only: expõe apenas registrar(), sem update/delete (DEC-010)', () => {
    const metodos = Object.getOwnPropertyNames(
      Object.getPrototypeOf(auditoriaService),
    ).filter((metodo) => metodo !== 'constructor');

    expect(metodos).toEqual(['registrar']);
    expect(
      (auditoriaService as unknown as Record<string, unknown>).update,
    ).toBeUndefined();
    expect(
      (auditoriaService as unknown as Record<string, unknown>).delete,
    ).toBeUndefined();
  });
});
