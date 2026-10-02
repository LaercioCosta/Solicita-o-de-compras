import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Documento, Pagamento } from '../generated/prisma/client.js';
import type { ArquivoUpload } from '../documentos/uploads.service.js';
import { UploadsService } from '../documentos/uploads.service.js';
import { validarTransicao } from '../solicitacoes/solicitacoes.state-machine.js';
import type { RegistrarDadosPagamentoDto } from './dto/registrar-dados-pagamento.dto.js';

const perfisPagadores = ['GERENTE_FINANCEIRA', 'FINANCEIRO'];

@Injectable()
export class PagamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly uploads: UploadsService,
  ) {}

  async registrarDados(
    usuario: UsuarioAutenticado,
    idSolicitacao: number,
    dto: RegistrarDadosPagamentoDto,
  ): Promise<Pagamento> {
    if (usuario.perfil !== 'TI') {
      throw new ForbiddenException(
        'Apenas a TI registra os dados de pagamento',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const solicitacao = await tx.solicitacao.findUnique({
        where: { id: idSolicitacao },
      });

      if (!solicitacao) {
        throw new NotFoundException('Solicitação não encontrada');
      }

      validarTransicao(solicitacao.status, 'AGUARDANDO_FINANCEIRO');

      const compra = await tx.compra.findUnique({
        where: { solicitacaoId: idSolicitacao },
        select: { id: true },
      });

      if (!compra) {
        throw new ConflictException('A solicitação não possui compra associada');
      }

      const pagamento = await tx.pagamento.create({
        data: {
          compraId: compra.id,
          forma: dto.forma,
          dados: dto.dados,
          registradoPorId: usuario.id,
        },
      });

      const { count } = await tx.solicitacao.updateMany({
        where: { id: idSolicitacao, status: solicitacao.status },
        data: { status: 'AGUARDANDO_FINANCEIRO' },
      });

      if (count === 0) {
        throw new ConflictException(
          'A solicitação mudou de estado durante o registro dos dados de pagamento',
        );
      }

      await this.auditoria.registrar(
        {
          usuarioId: usuario.id,
          perfil: usuario.perfil,
          acao: 'COMPRAR',
          entidade: 'pagamento',
          entidadeId: pagamento.id,
          estadoAnterior: solicitacao.status,
          estadoNovo: 'AGUARDANDO_FINANCEIRO',
          dados: {
            etapa: 'envio_pagamento',
            forma: dto.forma,
            solicitacaoId: idSolicitacao,
          },
        },
        tx,
      );

      return pagamento;
    });
  }

  async pagar(
    usuario: UsuarioAutenticado,
    idPagamento: number,
    valorPago: string | undefined,
    arquivo: ArquivoUpload | undefined,
  ): Promise<{ pagamento: Pagamento; documento: Documento }> {
    if (!perfisPagadores.includes(usuario.perfil)) {
      throw new ForbiddenException(
        'Apenas a Gerente Financeira ou o Financeiro executa o pagamento',
      );
    }

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { id: idPagamento },
      include: { compra: { include: { solicitacao: true } } },
    });

    if (!pagamento) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    if (pagamento.pagoPorId !== null) {
      throw new ConflictException('Pagamento já executado');
    }

    validarTransicao(pagamento.compra.solicitacao.status, 'PAGO');

    const valor = validarValorPago(valorPago);
    const armazenado = await this.uploads.armazenar(arquivo);

    const resultado = await this.prisma
      .$transaction(async (tx) => {
        const documento = await tx.documento.create({
          data: {
            tipo: 'COMPROVANTE_PAGAMENTO',
            nomeOriginal: armazenado.nomeOriginal,
            mimeType: armazenado.mimeType,
            tamanhoBytes: armazenado.tamanhoBytes,
            hash: armazenado.hash,
            nomeArmazenado: armazenado.nomeArmazenado,
            donoId: usuario.id,
            compraId: pagamento.compraId,
            pagamentoId: pagamento.id,
          },
        });

        const pago = await tx.pagamento.update({
          where: { id: pagamento.id },
          data: { valorPago: valor, pagoPorId: usuario.id, pagoEm: new Date() },
        });

        const { count } = await tx.solicitacao.updateMany({
          where: {
            id: pagamento.compra.solicitacaoId,
            status: 'AGUARDANDO_FINANCEIRO',
          },
          data: { status: 'PAGO' },
        });

        if (count === 0) {
          throw new ConflictException(
            'A solicitação mudou de estado durante o pagamento',
          );
        }

        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            perfil: usuario.perfil,
            acao: 'PAGAR',
            entidade: 'pagamento',
            entidadeId: pagamento.id,
            estadoAnterior: 'AGUARDANDO_FINANCEIRO',
            estadoNovo: 'PAGO',
            dados: {
              pagamentoId: pagamento.id,
              valorPago: valor,
              documentoId: documento.id,
            },
          },
          tx,
        );

        return { documento, pagamento: pago };
      })
      .catch(async (erro) => {
        await this.uploads.remover(armazenado.nomeArmazenado);
        throw erro;
      });

    return resultado;
  }
}

function validarValorPago(valorPago: string | undefined): number {
  if (!valorPago || !/^\d{1,10}(\.\d{1,2})?$/.test(valorPago)) {
    throw new BadRequestException(
      'valorPago deve ser um número decimal maior que zero',
    );
  }

  const valor = Number(valorPago);

  if (valor <= 0) {
    throw new BadRequestException(
      'valorPago deve ser um número decimal maior que zero',
    );
  }

  return valor;
}
