import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { NotificacaoResposta } from './notificacoes.service.js';
import { NotificacoesService } from './notificacoes.service.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

function paraId(valor: string): number {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundException('Notificação não encontrada');
  }

  return id;
}

@ApiTags('Notificações')
@ApiBearerAuth()
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoesService: NotificacoesService) {}

  @ApiOperation({ summary: 'Lista notificações do usuário autenticado' })
  @Get()
  listar(
    @Req() requisicao: RequisicaoAutenticada,
  ): Promise<NotificacaoResposta[]> {
    return this.notificacoesService.listar(requisicao.user);
  }

  @ApiOperation({
    summary:
      'Marca uma notificação do próprio usuário como lida (idempotente)',
  })
  @HttpCode(HttpStatus.OK)
  @Post(':id/lida')
  marcarLida(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
  ): Promise<NotificacaoResposta> {
    return this.notificacoesService.marcarLida(
      requisicao.user,
      paraId(id),
    );
  }
}
