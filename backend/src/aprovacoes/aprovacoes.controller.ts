import {
  Body,
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
import { DecisaoAprovacaoDto } from './dto/decisao-aprovacao.dto.js';
import { AprovacoesService } from './aprovacoes.service.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@ApiTags('Aprovações')
@ApiBearerAuth()
@Controller('solicitacoes')
export class AprovacoesController {
  constructor(private readonly aprovacoesService: AprovacoesService) {}

  @RequirePermissao('aprovacao', 'aprovar')
  @HttpCode(HttpStatus.OK)
  @Post(':id/decisao')
  decidir(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: DecisaoAprovacaoDto,
  ) {
    return this.aprovacoesService.decidir(
      requisicao.user,
      paraIdParametro(id, 'Solicitação não encontrada'),
      dto,
    );
  }
}
