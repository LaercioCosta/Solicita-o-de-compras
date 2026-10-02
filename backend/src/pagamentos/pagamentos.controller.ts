import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
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
import { RegistrarDadosPagamentoDto } from './dto/registrar-dados-pagamento.dto.js';
import { PagamentosService } from './pagamentos.service.js';
import type { ArquivoUpload } from '../documentos/uploads.service.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

type RequisicaoComArquivo = Request & {
  user: UsuarioAutenticado;
  file?: ArquivoUpload;
};

@ApiTags('Pagamentos')
@ApiBearerAuth()
@Controller()
export class PagamentosController {
  constructor(private readonly pagamentosService: PagamentosService) {}

  @RequirePermissao('pagamento', 'registrar')
  @ApiOperation({ summary: 'Registra dados de pagamento (boleto/PIX)' })
  @HttpCode(HttpStatus.OK)
  @Post('solicitacoes/:id/pagamento-dados')
  registrarDados(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: RegistrarDadosPagamentoDto,
  ) {
    return this.pagamentosService.registrarDados(
      requisicao.user,
      paraIdParametro(id, 'Solicitação não encontrada'),
      dto,
    );
  }

  @RequirePermissao('pagamento', 'executar')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 12 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Executa pagamento com comprovante anexado' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        arquivo: { type: 'string', format: 'binary' },
        valorPago: { type: 'number' },
      },
      required: ['arquivo'],
    },
  })
  @HttpCode(HttpStatus.OK)
  @Post('pagamentos/:id/pagar')
  pagar(@Req() requisicao: RequisicaoComArquivo, @Param('id') id: string) {
    const corpo = (requisicao.body ?? {}) as { valorPago?: string };

    return this.pagamentosService.pagar(
      requisicao.user,
      paraIdParametro(id, 'Pagamento não encontrado'),
      corpo.valorPago,
      requisicao.file,
    );
  }
}
