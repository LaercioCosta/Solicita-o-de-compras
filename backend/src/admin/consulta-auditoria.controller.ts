import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermissao } from '../auth/require-permissao.decorator.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria.dto.js';
import {
  ConsultaAuditoriaService,
  type RegistroAuditoriaResposta,
} from './consulta-auditoria.service.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@ApiTags('Auditoria (Admin)')
@ApiBearerAuth()
@Controller('auditoria')
export class ConsultaAuditoriaController {
  constructor(private readonly consultaAuditoria: ConsultaAuditoriaService) {}

  @RequirePermissao('auditoria', 'visualizar')
  @ApiOperation({ summary: 'Lista registros de auditoria (somente leitura)' })
  @ApiQuery({ name: 'entidade', required: false })
  @ApiQuery({ name: 'entidadeId', required: false })
  @ApiQuery({ name: 'usuarioId', required: false })
  @ApiQuery({ name: 'acao', required: false })
  @ApiQuery({ name: 'estadoNovo', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Get()
  listar(
    @Req() _requisicao: RequisicaoAutenticada,
    @Query() query: ListarAuditoriaQueryDto,
  ): Promise<RegistroAuditoriaResposta[]> {
    return this.consultaAuditoria.listar(query);
  }
}
