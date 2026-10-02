import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';

export interface NotificacaoResposta {
  id: number;
  mensagem: string;
  lida: boolean;
  lidaEm: Date | null;
  createdAt: Date;
  solicitacaoId: number | null;
}

const camposResposta = {
  id: true,
  mensagem: true,
  lida: true,
  lidaEm: true,
  createdAt: true,
  solicitacaoId: true,
} satisfies Prisma.NotificacaoSelect;

@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  listar(usuario: UsuarioAutenticado): Promise<NotificacaoResposta[]> {
    return this.prisma.notificacao.findMany({
      where: { usuarioId: usuario.id },
      select: camposResposta,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async marcarLida(
    usuario: UsuarioAutenticado,
    id: number,
  ): Promise<NotificacaoResposta> {
    const notificacao = await this.prisma.notificacao.findFirst({
      where: { id, usuarioId: usuario.id },
      select: camposResposta,
    });

    if (!notificacao) {
      throw new NotFoundException('Notificação não encontrada');
    }

    if (notificacao.lida) {
      return notificacao;
    }

    return this.prisma.notificacao.update({
      where: { id },
      data: { lida: true, lidaEm: new Date() },
      select: camposResposta,
    });
  }

  async notificarTi(
    tx: Prisma.TransactionClient,
    solicitacaoId: number,
    mensagem: string,
  ): Promise<void> {
    const usuariosTi = await tx.usuario.findMany({
      where: { perfil: { slug: 'TI' } },
      select: { id: true },
    });

    if (usuariosTi.length === 0) {
      return;
    }

    await tx.notificacao.createMany({
      data: usuariosTi.map(({ id }) => ({
        usuarioId: id,
        mensagem,
        solicitacaoId,
      })),
    });
  }
}
