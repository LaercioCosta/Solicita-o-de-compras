import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Compra } from '../generated/prisma/client.js';
import { validarTransicao } from '../solicitacoes/solicitacoes.state-machine.js';

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async executar(
    usuario: UsuarioAutenticado,
    idSolicitacao: number,
  ): Promise<Compra> {
    return this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({
        where: { id: idSolicitacao },
      });

      if (!solicitacao) {
        throw new NotFoundException('Solicitação não encontrada');
      }

      if (usuario.perfil !== 'TI') {
        throw new ForbiddenException('Apenas a TI executa a compra');
      }

      validarTransicao(solicitacao.status, 'COMPRA_EM_ANDAMENTO');

      const aprovacaoFinanceira = await tx.aprovacao.findFirst({
        where: {
          solicitacaoId: idSolicitacao,
          nivel: 'FINANCEIRA',
          decisao: 'APROVADO',
          cicloAprovacao: solicitacao.cicloAprovacao,
        },
        orderBy: { id: 'desc' },
        select: { orcamentoId: true },
      });

      if (!aprovacaoFinanceira) {
        throw new ConflictException(
          'Orçamento aprovado no nível financeiro não encontrado para o ciclo atual',
        );
      }

      const compra = await tx.compra.create({
        data: {
          solicitacaoId: idSolicitacao,
          orcamentoId: aprovacaoFinanceira.orcamentoId,
          executanteId: usuario.id,
        },
      });

      const { count } = await tx.solicitacao.updateMany({
        where: { id: idSolicitacao, status: solicitacao.status },
        data: { status: 'COMPRA_EM_ANDAMENTO' },
      });

      if (count === 0) {
        throw new ConflictException(
          'A solicitação mudou de estado durante a compra',
        );
      }

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: 'COMPRAR',
          entidade: 'compra',
          entidadeId: compra.id,
          estadoAnterior: solicitacao.status,
          estadoNovo: 'COMPRA_EM_ANDAMENTO',
          dados: {
            solicitacaoId: idSolicitacao,
            orcamentoId: compra.orcamentoId,
          },
        },
        tx,
      );

      return compra;
    });
  }
}
