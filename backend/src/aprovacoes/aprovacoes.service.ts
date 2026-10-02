import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { NotificacoesService } from '../notificacoes/notificacoes.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  EstadoSolicitacao,
  NivelAprovacao,
  SetorSlug,
} from '../generated/prisma/enums.js';
import { validarTransicao } from '../solicitacoes/solicitacoes.state-machine.js';
import type { DecisaoAprovacaoDto } from './dto/decisao-aprovacao.dto.js';
import {
  validarAprovadorNivelSetor,
  validarGerenteDoSetor,
} from './aprovadores.js';

const nivelPorStatus: Partial<Record<EstadoSolicitacao, NivelAprovacao>> = {
  AGUARDANDO_APROVACAO_SETOR: 'SETOR',
  AGUARDANDO_APROVACAO_FINANCEIRA: 'FINANCEIRA',
};

@Injectable()
export class AprovacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async decidir(
    usuario: UsuarioAutenticado,
    id: number,
    dto: DecisaoAprovacaoDto,
  ) {
    try {
      await this.decidirEmTransacao(usuario, id, dto);
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        (erro.code === 'P2002' || erro.code === 'P2034')
      ) {
        throw new ConflictException(
          'Decisão já registrada para este nível — tente novamente',
        );
      }
      throw erro;
    }

    const atualizada = await this.prisma.solicitacao.findUniqueOrThrow({
      where: { id },
    });

    return atualizada;
  }

  private decidirEmTransacao(
    usuario: UsuarioAutenticado,
    id: number,
    dto: DecisaoAprovacaoDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({
        where: { id },
        include: { setor: { select: { slug: true } } },
      });

      if (!solicitacao) {
        throw new NotFoundException('Solicitação não encontrada');
      }

      validarGerenteDoSetor(usuario, solicitacao.setorId);

      const nivel = nivelPorStatus[solicitacao.status];

      if (!nivel) {
        throw new ConflictException(
          `A solicitação não está aguardando decisão de aprovação no estado ${solicitacao.status}`,
        );
      }

      this.validarAprovadorNivel(usuario, solicitacao.setor.slug, nivel);

      const orcamento = await tx.orcamento.findFirst({
        where: { id: dto.orcamentoId, solicitacaoId: id },
        select: { id: true },
      });

      if (!orcamento) {
        throw new UnprocessableEntityException(
          'O orçamento informado não pertence à solicitação',
        );
      }

      const estadoNovo: EstadoSolicitacao =
        dto.decisao === 'REPROVADO'
          ? 'REPROVADO'
          : nivel === 'SETOR'
            ? 'AGUARDANDO_APROVACAO_FINANCEIRA'
            : 'APROVADO';

      validarTransicao(solicitacao.status, estadoNovo);

      const aprovacao = await this.criarAprovacao(tx, {
        solicitacaoId: id,
        orcamentoId: dto.orcamentoId,
        aprovadorId: usuario.id,
        nivel,
        decisao: dto.decisao,
        cicloAprovacao: solicitacao.cicloAprovacao,
        observacao: dto.observacao ?? null,
      });

      const { count } = await tx.solicitacao.updateMany({
        where: { id, status: solicitacao.status },
        data: { status: estadoNovo },
      });

      if (count === 0) {
        throw new ConflictException(
          'A solicitação mudou de estado durante a decisão',
        );
      }

      if (estadoNovo === 'APROVADO') {
        await this.notificacoes.notificarTi(
          tx,
          id,
          `Solicitação #${id} aprovada nos dois níveis e pronta para a compra`,
        );
      }

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: dto.decisao === 'APROVADO' ? 'APROVAR' : 'REPROVAR',
          entidade: 'solicitacao',
          entidadeId: id,
          estadoAnterior: solicitacao.status,
          estadoNovo,
          dados: {
            orcamentoId: dto.orcamentoId,
            nivel,
            decisao: dto.decisao,
          },
        },
        tx,
      );

      return {
        estadoAnterior: solicitacao.status,
        estadoNovo,
        nivel,
        aprovacaoId: aprovacao.id,
      };
    });
  }

  private async criarAprovacao(
    tx: Prisma.TransactionClient,
    dados: {
      solicitacaoId: number;
      orcamentoId: number;
      aprovadorId: number;
      nivel: NivelAprovacao;
      decisao: 'APROVADO' | 'REPROVADO';
      cicloAprovacao: number;
      observacao: string | null;
    },
  ) {
    try {
      return await tx.aprovacao.create({ data: dados });
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        (erro.code === 'P2002' || erro.code === 'P2034')
      ) {
        throw new ConflictException('Decisão já registrada para este nível');
      }
      throw erro;
    }
  }

  private validarAprovadorNivel(
    usuario: UsuarioAutenticado,
    slugSetor: SetorSlug,
    nivel: NivelAprovacao,
  ): void {
    if (nivel === 'SETOR') {
      validarAprovadorNivelSetor(usuario, slugSetor);
      return;
    }

    if (usuario.perfil === 'GERENTE_FINANCEIRA') {
      return;
    }

    throw new ForbiddenException(
      'Você não é o aprovador responsável pelo nível atual desta solicitação',
    );
  }
}
