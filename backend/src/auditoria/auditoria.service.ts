import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Auditoria } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  AcaoAuditoria,
  PerfilUsuario,
} from '../generated/prisma/enums.js';

export interface DadosRegistroAuditoria {
  usuarioId: number;
  perfil: PerfilUsuario;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId: number;
  estadoAnterior?: string;
  estadoNovo?: string;
  dados?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava um registro de auditoria (append-only — DEC-010/RN-05).
   *
   * Quando a ação crítica acontece dentro de uma `$transaction`, passe o
   * client transacional (`tx`) para que o registro faça commit/rollback junto
   * com a ação (CA-09.1 atômico; DEC-010). Sem `client`, usa a conexão padrão.
   */
  registrar(
    dados: DadosRegistroAuditoria,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Auditoria> {
    return client.auditoria.create({
      data: {
        usuarioId: dados.usuarioId,
        perfil: dados.perfil,
        acao: dados.acao,
        entidade: dados.entidade,
        entidadeId: dados.entidadeId,
        estadoAnterior: dados.estadoAnterior,
        estadoNovo: dados.estadoNovo,
        dados: dados.dados,
      },
    });
  }
}
