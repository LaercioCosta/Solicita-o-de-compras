import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissao } from '../auth/require-permissao.decorator.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { paraIdParametro } from '../comum/parametros.util.js';
import { AtualizarSetorDto } from './dto/atualizar-setor.dto.js';
import { CriarSetorDto } from './dto/criar-setor.dto.js';
import { AdminSetoresService } from './setores.service.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@ApiTags('Setores (Admin)')
@ApiBearerAuth()
@Controller('setores')
export class AdminSetoresController {
  constructor(private readonly setoresService: AdminSetoresService) {}

  @RequirePermissao('setor', 'criar')
  @ApiOperation({ summary: 'Cria um setor (slug do enum SetorSlug; único)' })
  @Post()
  criar(
    @Req() requisicao: RequisicaoAutenticada,
    @Body() dto: CriarSetorDto,
  ) {
    return this.setoresService.criar(requisicao.user, dto);
  }

  @RequirePermissao('setor', 'visualizar')
  @ApiOperation({ summary: 'Lista setores' })
  @Get()
  listar() {
    return this.setoresService.listar();
  }

  @RequirePermissao('setor', 'editar')
  @ApiOperation({ summary: 'Edita o nome de um setor' })
  @Patch(':id')
  atualizar(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: AtualizarSetorDto,
  ) {
    return this.setoresService.atualizar(
      requisicao.user,
      paraIdParametro(id, 'Setor não encontrado'),
      dto,
    );
  }
}
