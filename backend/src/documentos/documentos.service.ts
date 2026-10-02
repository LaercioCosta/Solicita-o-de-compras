import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Documento, Solicitacao } from '../generated/prisma/client.js';
import {
  ESTADOS_REABERTURA,
  ESTADOS_VISIVEIS_FINANCEIRO,
  ESTADOS_VISIVEIS_TI,
  validarEstadoEditavel,
  validarTransicao,
} from '../solicitacoes/solicitacoes.state-machine.js';
import type { ArquivoUpload } from './uploads.service.js';
import { UploadsService } from './uploads.service.js';

export interface DownloadDocumento {
  conteudo: Buffer;
  nomeOriginal: string;
  mimeType: string;
}

export interface DocumentoOrcamentoAnexado {
  documento: Documento;
  reabertura: boolean;
}

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly uploads: UploadsService,
  ) {}

  async anexarNf(
    usuario: UsuarioAutenticado,
    idSolicitacao: number,
    arquivo: ArquivoUpload | undefined,
  ): Promise<Documento> {
    if (usuario.perfil !== 'TI') {
      throw new ForbiddenException('Apenas a TI anexa a nota fiscal');
    }

    const solicitacao = await this.prisma.solicitacao.findUnique({
      where: { id: idSolicitacao },
      include: { compra: { select: { id: true } } },
    });

    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    validarTransicao(solicitacao.status, 'CONCLUIDO');

    if (!solicitacao.compra) {
      throw new ConflictException('A solicitação não possui compra associada');
    }

    const compraId = solicitacao.compra.id;

    const comprovante = await this.prisma.documento.findFirst({
      where: { compraId, tipo: 'COMPROVANTE_PAGAMENTO' },
      select: { id: true },
    });

    if (!comprovante) {
      throw new UnprocessableEntityException(
        'A nota fiscal somente pode ser anexada após o comprovante de pagamento',
      );
    }

    const armazenado = await this.uploads.armazenar(arquivo);

    const documento = await this.prisma
      .$transaction(async (tx) => {
        const criado = await tx.documento.create({
          data: {
            tipo: 'NOTA_FISCAL',
            nomeOriginal: armazenado.nomeOriginal,
            mimeType: armazenado.mimeType,
            tamanhoBytes: armazenado.tamanhoBytes,
            hash: armazenado.hash,
            nomeArmazenado: armazenado.nomeArmazenado,
            donoId: usuario.id,
            compraId,
          },
        });

        const { count } = await tx.solicitacao.updateMany({
          where: { id: idSolicitacao, status: solicitacao.status },
          data: { status: 'CONCLUIDO' },
        });

        if (count === 0) {
          throw new ConflictException(
            'A solicitação mudou de estado durante o anexo da nota fiscal',
          );
        }

        await this.auditoria.registrar(
          {
            usuarioId: usuario.id,
            perfil: usuario.perfil,
            acao: 'CONCLUIR',
            entidade: 'solicitacao',
            entidadeId: idSolicitacao,
            estadoAnterior: solicitacao.status,
            estadoNovo: 'CONCLUIDO',
            dados: { documentoNfId: criado.id },
          },
          tx,
        );

        return criado;
      })
      .catch(async (erro) => {
        await this.uploads.remover(armazenado.nomeArmazenado);
        throw erro;
      });

    return documento;
  }

  async anexarDocumentoOrcamento(
    usuario: UsuarioAutenticado,
    idSolicitacao: number,
    idOrcamento: number,
    arquivo: ArquivoUpload | undefined,
  ): Promise<DocumentoOrcamentoAnexado> {
    if (usuario.perfil !== 'SOLICITANTE') {
      throw new ForbiddenException(
        'Apenas o solicitante anexa documentos de orçamento',
      );
    }

    const solicitacao = await this.prisma.solicitacao.findUnique({
      where: { id: idSolicitacao },
    });

    if (!solicitacao || solicitacao.solicitanteId !== usuario.id) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    const orcamento = await this.prisma.orcamento.findFirst({
      where: { id: idOrcamento, solicitacaoId: idSolicitacao },
    });

    if (!orcamento) {
      throw new NotFoundException('Orçamento não encontrado');
    }

    const reabertura = ESTADOS_REABERTURA.includes(solicitacao.status);

    if (!reabertura) {
      validarEstadoEditavel(solicitacao.status);
    }

    const armazenado = await this.uploads.armazenar(arquivo);

    const dadosDocumento = {
      tipo: 'ORCAMENTO' as const,
      nomeOriginal: armazenado.nomeOriginal,
      mimeType: armazenado.mimeType,
      tamanhoBytes: armazenado.tamanhoBytes,
      hash: armazenado.hash,
      nomeArmazenado: armazenado.nomeArmazenado,
      donoId: usuario.id,
      orcamentoId: orcamento.id,
    };

    const cicloNovo = solicitacao.cicloAprovacao + 1;

    let documento: Documento;

    if (reabertura) {
      documento = await this.prisma
        .$transaction(async (tx) => {
          const criado = await tx.documento.create({ data: dadosDocumento });

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
              'A solicitação mudou de estado durante o anexo do documento',
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
              },
            },
            tx,
          );

          return criado;
        })
        .catch(async (erro) => {
          await this.uploads.remover(armazenado.nomeArmazenado);
          throw erro;
        });
    } else {
      documento = await this.prisma.documento
        .create({ data: dadosDocumento })
        .catch(async (erro) => {
          await this.uploads.remover(armazenado.nomeArmazenado);
          throw erro;
        });

      // Fora de $transaction: este fluxo é uma única escrita (create) e não
      // possui transação correspondente — auditoria segue no client padrão
      // (mantido como está, cf. TASK-071 critério 1).
      await this.auditoria.registrar({
        usuarioId: usuario.id,
        perfil: usuario.perfil,
        acao: 'CORRIGIR',
        entidade: 'documento',
        entidadeId: documento.id,
        dados: {
          orcamentoId: orcamento.id,
          tipo: dadosDocumento.tipo,
        },
      });
    }

    return { documento, reabertura };
  }

  async download(
    usuario: UsuarioAutenticado,
    idDocumento: number,
  ): Promise<DownloadDocumento> {
    const documento = await this.prisma.documento.findUnique({
      where: { id: idDocumento },
      include: {
        orcamento: { select: { solicitacaoId: true } },
        compra: { select: { solicitacaoId: true } },
        pagamento: { select: { compra: { select: { solicitacaoId: true } } } },
      },
    });

    if (!documento) {
      throw new NotFoundException('Documento não encontrado');
    }

    const solicitacaoId =
      documento.orcamento?.solicitacaoId ??
      documento.compra?.solicitacaoId ??
      documento.pagamento?.compra.solicitacaoId ??
      null;

    if (solicitacaoId === null) {
      throw new NotFoundException('Documento não encontrado');
    }

    const solicitacao = await this.prisma.solicitacao.findUnique({
      where: { id: solicitacaoId },
    });

    if (!solicitacao || !this.podeAcessar(usuario, solicitacao)) {
      throw new NotFoundException('Documento não encontrado');
    }

    const conteudo = await this.uploads.ler(documento.nomeArmazenado);

    return {
      conteudo,
      nomeOriginal: documento.nomeOriginal,
      mimeType: documento.mimeType,
    };
  }

  private podeAcessar(
    usuario: UsuarioAutenticado,
    solicitacao: Solicitacao,
  ): boolean {
    switch (usuario.perfil) {
      case 'SOLICITANTE':
        return solicitacao.solicitanteId === usuario.id;
      case 'GERENTE':
        return usuario.setorId === solicitacao.setorId;
      case 'GERENTE_FINANCEIRA':
        return true;
      case 'TI':
        return ESTADOS_VISIVEIS_TI.includes(solicitacao.status);
      case 'FINANCEIRO':
        return ESTADOS_VISIVEIS_FINANCEIRO.includes(solicitacao.status);
      default:
        return false;
    }
  }
}
