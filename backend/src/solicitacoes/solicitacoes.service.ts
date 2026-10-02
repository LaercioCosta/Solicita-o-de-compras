import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  Compra,
  Orcamento,
  Pagamento,
} from '../generated/prisma/client.js';
import {
  validarAprovadorNivelSetor,
  validarGerenteDoSetor,
} from '../aprovacoes/aprovadores.js';
import type { AtualizarOrcamentoDto } from './dto/atualizar-orcamento.dto.js';
import type { AtualizarSolicitacaoDto } from './dto/atualizar-solicitacao.dto.js';
import type { CancelarSolicitacaoDto } from './dto/cancelar-solicitacao.dto.js';
import type { CriarOrcamentoDto } from './dto/criar-orcamento.dto.js';
import type { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto.js';
import type { DevolverCorrecaoDto } from './dto/devolver-correcao.dto.js';
import type { ListarSolicitacoesQueryDto } from './dto/listar-solicitacoes.dto.js';
import {
  ESTADOS_REABERTURA,
  ESTADOS_VISIVEIS_FINANCEIRO,
  ESTADOS_VISIVEIS_TI,
  validarEstadoEditavel,
  validarTransicao,
} from './solicitacoes.state-machine.js';

const totalOrcamentosExigido = 3;
const totalOrcamentosMaximo = 3;

const selecaoSetor = {
  id: true,
  slug: true,
  nome: true,
} satisfies Prisma.SetorSelect;

const inclusaoDetalhe = {
  itens: true,
  orcamentos: true,
} satisfies Prisma.SolicitacaoInclude;

const inclusaoLista = {
  setor: { select: selecaoSetor },
  _count: { select: { orcamentos: true, itens: true } },
} satisfies Prisma.SolicitacaoInclude;

const selecaoDocumento = {
  id: true,
  tipo: true,
  nomeOriginal: true,
  mimeType: true,
  tamanhoBytes: true,
  orcamentoId: true,
  compraId: true,
  pagamentoId: true,
} satisfies Prisma.DocumentoSelect;

const selecaoCompra = {
  id: true,
  orcamentoId: true,
  pagamentos: { orderBy: { id: 'desc' } },
} satisfies Prisma.CompraSelect;

const inclusaoDetalheCompleto = {
  itens: true,
  orcamentos: true,
  setor: { select: selecaoSetor },
  compra: { select: selecaoCompra },
} satisfies Prisma.SolicitacaoInclude;

type SolicitacaoDetalhe = Prisma.SolicitacaoGetPayload<{
  include: typeof inclusaoDetalheCompleto;
}>;

export type DocumentoSolicitacaoResposta = Prisma.DocumentoGetPayload<{
  select: typeof selecaoDocumento;
}>;

export type PagamentoResposta = Pick<
  Pagamento,
  'id' | 'forma' | 'dados' | 'valorPago' | 'pagoEm'
>;

export type CompraResposta = Pick<Compra, 'id' | 'orcamentoId'>;

export interface SolicitacaoDetalheResposta
  extends Omit<SolicitacaoDetalhe, 'compra'> {
  compra: CompraResposta | null;
  pagamento: PagamentoResposta | null;
  documentos: DocumentoSolicitacaoResposta[];
}

@Injectable()
export class SolicitacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(usuario: UsuarioAutenticado, dto: CriarSolicitacaoDto) {
    const criada = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.solicitacao.create({
        data: {
          descricao: dto.descricao,
          solicitanteId: usuario.id,
          setorId: usuario.setorId,
          itens: {
            create: dto.itens.map((item) => ({
              produto: item.produto,
              quantidade: item.quantidade,
              valorUnitarioEstimado: item.valorUnitarioEstimado,
            })),
          },
        },
        include: inclusaoDetalhe,
      });

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: 'CRIAR',
          entidade: 'solicitacao',
          entidadeId: criada.id,
          estadoNovo: criada.status,
        },
        tx,
      );

      return criada;
    });

    return criada;
  }

  async criarOrcamento(
    usuario: UsuarioAutenticado,
    idSolicitacao: number,
    dto: CriarOrcamentoDto,
  ): Promise<Orcamento> {
    const orcamento = await this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({
        where: { id: idSolicitacao },
      });

      if (!solicitacao || solicitacao.solicitanteId !== usuario.id) {
        throw new NotFoundException('Solicitação não encontrada');
      }

      validarEstadoEditavel(solicitacao.status);

      const totalOrcamentos = await tx.orcamento.count({
        where: { solicitacaoId: idSolicitacao },
      });

      if (totalOrcamentos >= totalOrcamentosMaximo) {
        throw new UnprocessableEntityException(
          'A solicitação já possui o máximo de 3 orçamentos',
        );
      }

      const orcamento = await tx.orcamento.create({
        data: {
          solicitacaoId: idSolicitacao,
          linkLoja: dto.linkLoja,
          cnpjLoja: dto.cnpjLoja,
          valor: dto.valor,
          validadeAte: dto.validadeAte ?? null,
        },
      });

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: 'CRIAR',
          entidade: 'orcamento',
          entidadeId: orcamento.id,
          dados: { solicitacaoId: idSolicitacao },
        },
        tx,
      );

      return orcamento;
    });

    return orcamento;
  }

  async listar(usuario: UsuarioAutenticado, query: ListarSolicitacoesQueryDto) {
    return this.prisma.solicitacao.findMany({
      where: {
        AND: [
          this.escopoVisualizacao(usuario),
          ...(query.status ? [{ status: query.status }] : []),
        ],
      },
      include: inclusaoLista,
      orderBy: { id: 'desc' },
      take: query.limit,
      skip: query.offset,
    });
  }

  async buscarPorId(
    usuario: UsuarioAutenticado,
    id: number,
  ): Promise<SolicitacaoDetalheResposta> {
    const solicitacao = await this.prisma.solicitacao.findFirst({
      where: { id, ...this.escopoVisualizacao(usuario) },
      include: inclusaoDetalheCompleto,
    });

    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    const documentos = await this.prisma.documento.findMany({
      where: {
        OR: [
          { orcamento: { solicitacaoId: id } },
          { compra: { solicitacaoId: id } },
          { pagamento: { compra: { solicitacaoId: id } } },
        ],
      },
      select: selecaoDocumento,
      orderBy: { id: 'asc' },
    });

    const ultimoPagamento = solicitacao.compra?.pagamentos[0] ?? null;

    return {
      ...solicitacao,
      compra: solicitacao.compra
        ? {
            id: solicitacao.compra.id,
            orcamentoId: solicitacao.compra.orcamentoId,
          }
        : null,
      pagamento: ultimoPagamento
        ? {
            id: ultimoPagamento.id,
            forma: ultimoPagamento.forma,
            dados: ultimoPagamento.dados,
            valorPago: ultimoPagamento.valorPago,
            pagoEm: ultimoPagamento.pagoEm,
          }
        : null,
      documentos,
    };
  }

  async atualizar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: AtualizarSolicitacaoDto,
  ) {
    const camposAlterados = ['descricao', 'itens'].filter(
      (campo) => dto[campo as keyof AtualizarSolicitacaoDto] !== undefined,
    );

    if (camposAlterados.length === 0) {
      throw new BadRequestException(
        'Informe descricao ou itens para atualizar a solicitação',
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({ where: { id } });

      if (!solicitacao || solicitacao.solicitanteId !== usuario.id) {
        throw new NotFoundException('Solicitação não encontrada');
      }

      const dadosEdicao = {
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.itens !== undefined
          ? {
              itens: {
                deleteMany: {},
                create: dto.itens.map((item) => ({
                  produto: item.produto,
                  quantidade: item.quantidade,
                  valorUnitarioEstimado: item.valorUnitarioEstimado,
                })),
              },
            }
          : {}),
      };

      if (ESTADOS_REABERTURA.includes(solicitacao.status)) {
        const cicloNovo = solicitacao.cicloAprovacao + 1;
        // Guard otimista com updateMany (campos escalares apenas — updateMany não
        // aceita nested writes); os itens são reescritos abaixo na mesma transação.
        const { count } = await tx.solicitacao.updateMany({
          where: {
            id,
            status: solicitacao.status,
            cicloAprovacao: solicitacao.cicloAprovacao,
          },
          data: {
            ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
            status: 'AGUARDANDO_APROVACAO_SETOR',
            cicloAprovacao: cicloNovo,
          },
        });

        if (count === 0) {
          throw new ConflictException(
            'A solicitação mudou de estado durante a alteração',
          );
        }

        if (dto.itens !== undefined) {
          await tx.solicitacaoItem.deleteMany({ where: { solicitacaoId: id } });
          await tx.solicitacaoItem.createMany({
            data: dto.itens.map((item) => ({
              solicitacaoId: id,
              produto: item.produto,
              quantidade: item.quantidade,
              valorUnitarioEstimado: item.valorUnitarioEstimado,
            })),
          });
        }

        const atualizada = await tx.solicitacao.findUniqueOrThrow({
          where: { id },
          include: inclusaoDetalhe,
        });

        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            perfil: usuario.perfil,
            acao: 'CORRIGIR',
            entidade: 'solicitacao',
            entidadeId: id,
            estadoAnterior: solicitacao.status,
            estadoNovo: 'AGUARDANDO_APROVACAO_SETOR',
            dados: {
              etapa: 'reabertura_aprovacao',
              cicloNovo,
              camposAlterados,
            },
          },
          tx,
        );

        return {
          estadoAnterior: solicitacao.status,
          estadoNovo: 'AGUARDANDO_APROVACAO_SETOR',
          cicloNovo,
          camposAlterados,
          reabertura: true,
          atualizada,
        };
      }

      validarEstadoEditavel(solicitacao.status);

      const atualizada = await tx.solicitacao.update({
        where: { id },
        data: dadosEdicao,
        include: inclusaoDetalhe,
      });

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: 'CORRIGIR',
          entidade: 'solicitacao',
          entidadeId: id,
          estadoAnterior: solicitacao.status,
          estadoNovo: solicitacao.status,
        },
        tx,
      );

      return {
        estadoAnterior: solicitacao.status,
        estadoNovo: solicitacao.status,
        cicloNovo: solicitacao.cicloAprovacao,
        camposAlterados,
        reabertura: false,
        atualizada,
      };
    });

    return resultado.atualizada;
  }

  async devolverCorrecao(
    usuario: UsuarioAutenticado,
    id: number,
    dto: DevolverCorrecaoDto,
  ) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({
        where: { id },
        include: { setor: { select: { slug: true } } },
      });

      if (!solicitacao) {
        throw new NotFoundException('Solicitação não encontrada');
      }

      validarGerenteDoSetor(usuario, solicitacao.setorId);

      if (solicitacao.status !== 'AGUARDANDO_APROVACAO_SETOR') {
        throw new ConflictException(
          `A solicitação não está aguardando aprovação de setor no estado ${solicitacao.status}`,
        );
      }

      validarAprovadorNivelSetor(usuario, solicitacao.setor.slug);
      validarTransicao(solicitacao.status, 'AGUARDANDO_CORRECAO');

      const { count } = await tx.solicitacao.updateMany({
        where: { id, status: solicitacao.status },
        data: { status: 'AGUARDANDO_CORRECAO' },
      });

      if (count === 0) {
        throw new ConflictException(
          'A solicitação mudou de estado durante a devolução para correção',
        );
      }

      const devolvida = await tx.solicitacao.findUniqueOrThrow({
        where: { id },
        include: inclusaoDetalhe,
      });

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: 'CORRIGIR',
          entidade: 'solicitacao',
          entidadeId: id,
          estadoAnterior: solicitacao.status,
          estadoNovo: 'AGUARDANDO_CORRECAO',
          dados: { etapa: 'devolucao_correcao', motivo: dto.motivo },
        },
        tx,
      );

      return { estadoAnterior: solicitacao.status, devolvida };
    });

    return resultado.devolvida;
  }

  async atualizarOrcamento(
    usuario: UsuarioAutenticado,
    idSolicitacao: number,
    orcamentoId: number,
    dto: AtualizarOrcamentoDto,
  ): Promise<Orcamento> {
    const camposAlterados = [
      'linkLoja',
      'cnpjLoja',
      'valor',
      'validadeAte',
    ].filter(
      (campo) => dto[campo as keyof AtualizarOrcamentoDto] !== undefined,
    );

    if (camposAlterados.length === 0) {
      throw new BadRequestException(
        'Informe linkLoja, cnpjLoja, valor ou validadeAte para atualizar o orçamento',
      );
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({
        where: { id: idSolicitacao },
      });

      if (!solicitacao || solicitacao.solicitanteId !== usuario.id) {
        throw new NotFoundException('Solicitação não encontrada');
      }

      const orcamento = await tx.orcamento.findFirst({
        where: { id: orcamentoId, solicitacaoId: idSolicitacao },
      });

      if (!orcamento) {
        throw new NotFoundException('Orçamento não encontrado');
      }

      const dadosEdicao = {
        ...(dto.linkLoja !== undefined ? { linkLoja: dto.linkLoja } : {}),
        ...(dto.cnpjLoja !== undefined ? { cnpjLoja: dto.cnpjLoja } : {}),
        ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
        ...(dto.validadeAte !== undefined
          ? { validadeAte: dto.validadeAte ?? null }
          : {}),
      };

      if (ESTADOS_REABERTURA.includes(solicitacao.status)) {
        const cicloNovo = solicitacao.cicloAprovacao + 1;
        const atualizado = await tx.orcamento.update({
          where: { id: orcamento.id },
          data: dadosEdicao,
        });

        const { count } = await tx.solicitacao.updateMany({
          where: {
            id: idSolicitacao,
            status: solicitacao.status,
            cicloAprovacao: solicitacao.cicloAprovacao,
          },
          data: {
            status: 'AGUARDANDO_APROVACAO_SETOR',
            cicloAprovacao: cicloNovo,
          },
        });

        if (count === 0) {
          throw new ConflictException(
            'A solicitação mudou de estado durante a alteração do orçamento',
          );
        }

        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            perfil: usuario.perfil,
            acao: 'CORRIGIR',
            entidade: 'solicitacao',
            entidadeId: idSolicitacao,
            estadoAnterior: solicitacao.status,
            estadoNovo: 'AGUARDANDO_APROVACAO_SETOR',
            dados: {
              etapa: 'reabertura_aprovacao',
              cicloNovo,
              camposAlterados,
            },
          },
          tx,
        );

        return {
          orcamento: atualizado,
          reabertura: true,
          estadoAnterior: solicitacao.status,
          cicloNovo,
          camposAlterados,
        };
      }

      validarEstadoEditavel(solicitacao.status);

      const atualizado = await tx.orcamento.update({
        where: { id: orcamento.id },
        data: dadosEdicao,
      });

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: 'CORRIGIR',
          entidade: 'orcamento',
          entidadeId: orcamentoId,
          dados: {
            solicitacaoId: idSolicitacao,
            camposAlterados,
          },
        },
        tx,
      );

      return {
        orcamento: atualizado,
        reabertura: false,
        estadoAnterior: solicitacao.status,
        cicloNovo: solicitacao.cicloAprovacao,
        camposAlterados,
      };
    });

    return resultado.orcamento;
  }

  async submeter(usuario: UsuarioAutenticado, id: number) {
    const { submetida } = await this.prisma.$transaction(
      async (tx) => {
        const solicitacao = await tx.solicitacao.findUnique({ where: { id } });

        if (!solicitacao || solicitacao.solicitanteId !== usuario.id) {
          throw new NotFoundException('Solicitação não encontrada');
        }

        validarTransicao(solicitacao.status, 'AGUARDANDO_APROVACAO_SETOR');

        const totalOrcamentos = await tx.orcamento.count({
          where: { solicitacaoId: id },
        });

        if (totalOrcamentos !== totalOrcamentosExigido) {
          throw new UnprocessableEntityException(
            'A solicitação precisa de exatamente 3 orçamentos para ser submetida',
          );
        }

        // Guard otimista (padrão do codebase) — evita corrida submeter×cancelar
        // sobrescrever CANCELADO (DEC-014; revisão Fase 10 achado #7).
        const { count } = await tx.solicitacao.updateMany({
          where: { id, status: solicitacao.status },
          data: { status: 'AGUARDANDO_APROVACAO_SETOR' },
        });
        if (count === 0) {
          throw new ConflictException(
            'A solicitação mudou de estado durante a submissão',
          );
        }

        const submetida = await tx.solicitacao.findUniqueOrThrow({
          where: { id },
          include: inclusaoDetalhe,
        });

        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            perfil: usuario.perfil,
            acao: 'SUBMETER',
            entidade: 'solicitacao',
            entidadeId: id,
            estadoAnterior: solicitacao.status,
            estadoNovo: 'AGUARDANDO_APROVACAO_SETOR',
          },
          tx,
        );

        return { estadoAnterior: solicitacao.status, submetida };
      },
    );

    return submetida;
  }

  async cancelar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: CancelarSolicitacaoDto,
  ) {
    const { cancelada } = await this.prisma.$transaction(
      async (tx) => {
        const solicitacao = await tx.solicitacao.findUnique({ where: { id } });

        if (!solicitacao || solicitacao.solicitanteId !== usuario.id) {
          throw new NotFoundException('Solicitação não encontrada');
        }

        validarTransicao(solicitacao.status, 'CANCELADO');

        const { count } = await tx.solicitacao.updateMany({
          where: { id, status: solicitacao.status },
          data: { status: 'CANCELADO', motivoCancelamento: dto.motivo },
        });
        if (count === 0) {
          throw new ConflictException(
            'A solicitação mudou de estado durante o cancelamento',
          );
        }

        const cancelada = await tx.solicitacao.findUniqueOrThrow({
          where: { id },
          include: inclusaoDetalhe,
        });

        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            perfil: usuario.perfil,
            acao: 'CANCELAR',
            entidade: 'solicitacao',
            entidadeId: id,
            estadoAnterior: solicitacao.status,
            estadoNovo: 'CANCELADO',
            dados: { motivoCancelamento: dto.motivo },
          },
          tx,
        );

        return { estadoAnterior: solicitacao.status, cancelada };
      },
    );

    return cancelada;
  }

  private escopoVisualizacao(
    usuario: UsuarioAutenticado,
  ): Prisma.SolicitacaoWhereInput {
    switch (usuario.perfil) {
      case 'SOLICITANTE':
        return { solicitanteId: usuario.id };
      case 'GERENTE':
        return { setorId: usuario.setorId };
      case 'GERENTE_FINANCEIRA':
        return {};
      case 'FINANCEIRO':
        return { status: { in: [...ESTADOS_VISIVEIS_FINANCEIRO] } };
      case 'TI':
        return { status: { in: [...ESTADOS_VISIVEIS_TI] } };
      default:
        throw new ForbiddenException('Perfil sem acesso a solicitações');
    }
  }
}
