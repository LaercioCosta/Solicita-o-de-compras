import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissao } from '../auth/require-permissao.decorator.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { paraIdParametro } from '../comum/parametros.util.js';
import { ComprasService } from './compras.service.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@ApiTags('Compras')
@ApiBearerAuth()
@Controller('solicitacoes')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @RequirePermissao('compra', 'executar')
  @HttpCode(HttpStatus.OK)
  @Post(':id/compra')
  executar(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
  ) {
    return this.comprasService.executar(
      requisicao.user,
      paraIdParametro(id, 'Solicitação não encontrada'),
    );
  }
}
