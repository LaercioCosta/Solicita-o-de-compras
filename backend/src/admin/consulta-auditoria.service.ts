import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ListarAuditoriaQueryDto } from './dto/listar-auditoria.dto.js';

export type RegistroAuditoriaResposta = Prisma.AuditoriaGetPayload<{
  include: { usuario: { select: { nome: true; email: true } } };
}>;

@Injectable()
export class ConsultaAuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  listar(
    query: ListarAuditoriaQueryDto,
  ): Promise<RegistroAuditoriaResposta[]> {
    return this.prisma.auditoria.findMany({
      where: {
        entidade: query.entidade,
        entidadeId: query.entidadeId,
        usuarioId: query.usuarioId,
        acao: query.acao,
        estadoNovo: query.estadoNovo,
      },
      include: { usuario: { select: { nome: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    });
  }
}
