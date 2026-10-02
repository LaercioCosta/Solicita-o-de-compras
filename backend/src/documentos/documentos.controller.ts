import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissao } from '../auth/require-permissao.decorator.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { paraIdParametro } from '../comum/parametros.util.js';
import { DocumentosService } from './documentos.service.js';
import type { ArquivoUpload } from './uploads.service.js';

type RequisicaoComArquivo = Request & {
  user: UsuarioAutenticado;
  file?: ArquivoUpload;
};

function cabecalhoNomeArquivo(nomeOriginal: string): string {
  const nome = nomeOriginal.replace(/["\\\r\n]/g, '_');
  return `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nomeOriginal)}`;
}

@ApiTags('Documentos')
@ApiBearerAuth()
@Controller('solicitacoes')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @RequirePermissao('documento', 'anexar')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 12 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Anexa a Nota Fiscal recebida da loja' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { arquivo: { type: 'string', format: 'binary' } },
      required: ['arquivo'],
    },
  })
  @HttpCode(HttpStatus.OK)
  @Post(':id/nf')
  anexarNf(@Req() requisicao: RequisicaoComArquivo, @Param('id') id: string) {
    return this.documentosService.anexarNf(
      requisicao.user,
      paraIdParametro(id, 'Solicitação não encontrada'),
      requisicao.file,
    );
  }

  @RequirePermissao('documento', 'anexar')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 12 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Anexa documento do orçamento (PDF/imagem)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { arquivo: { type: 'string', format: 'binary' } },
      required: ['arquivo'],
    },
  })
  @Post(':id/orcamentos/:orcamentoId/documento')
  async anexarDocumentoOrcamento(
    @Req() requisicao: RequisicaoComArquivo,
    @Param('id') id: string,
    @Param('orcamentoId') orcamentoId: string,
    @Res() resposta: Response,
  ): Promise<void> {
    const { documento, reabertura } =
      await this.documentosService.anexarDocumentoOrcamento(
        requisicao.user,
        paraIdParametro(id, 'Solicitação não encontrada'),
        paraIdParametro(orcamentoId, 'Orçamento não encontrado'),
        requisicao.file,
      );

    resposta
      .status(reabertura ? HttpStatus.OK : HttpStatus.CREATED)
      .json(documento);
  }
}

@ApiTags('Documentos')
@ApiBearerAuth()
@Controller('documentos')
export class DocumentosDownloadController {
  constructor(private readonly documentosService: DocumentosService) {}

  @RequirePermissao('documento', 'visualizar')
  @ApiOperation({ summary: 'Download do arquivo do documento' })
  @Get(':id/download')
  async baixar(
    @Req() requisicao: RequisicaoComArquivo,
    @Param('id') id: string,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const download = await this.documentosService.download(
      requisicao.user,
      paraIdParametro(id, 'Documento não encontrado'),
    );

    resposta.set({
      'Content-Type': download.mimeType,
      'Content-Disposition': cabecalhoNomeArquivo(download.nomeOriginal),
    });

    return new StreamableFile(download.conteudo);
  }
}
