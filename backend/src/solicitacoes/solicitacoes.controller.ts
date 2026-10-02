import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EstadoSolicitacao } from '../generated/prisma/enums.js';
import { RequirePermissao } from '../auth/require-permissao.decorator.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AtualizarOrcamentoDto } from './dto/atualizar-orcamento.dto.js';
import { AtualizarSolicitacaoDto } from './dto/atualizar-solicitacao.dto.js';
import { CancelarSolicitacaoDto } from './dto/cancelar-solicitacao.dto.js';
import { CriarOrcamentoDto } from './dto/criar-orcamento.dto.js';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto.js';
import { DevolverCorrecaoDto } from './dto/devolver-correcao.dto.js';
import { ListarSolicitacoesQueryDto } from './dto/listar-solicitacoes.dto.js';
import { SolicitacoesService } from './solicitacoes.service.js';

export type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

function paraId(valor: string): number {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundException('Solicitação não encontrada');
  }

  return id;
}

@ApiTags('Solicitações')
@ApiBearerAuth()
@Controller('solicitacoes')
export class SolicitacoesController {
  constructor(private readonly solicitacoesService: SolicitacoesService) {}

  @RequirePermissao('solicitacao', 'criar')
  @Post()
  criar(
    @Req() requisicao: RequisicaoAutenticada,
    @Body() dto: CriarSolicitacaoDto,
  ) {
    return this.solicitacoesService.criar(requisicao.user, dto);
  }

  @RequirePermissao('orcamento', 'criar')
  @Post(':id/orcamentos')
  criarOrcamento(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: CriarOrcamentoDto,
  ) {
    return this.solicitacoesService.criarOrcamento(
      requisicao.user,
      paraId(id),
      dto,
    );
  }

  @ApiQuery({
    name: 'status',
    required: false,
    enum: EstadoSolicitacao,
    description: 'Filtra pelo estado da solicitação dentro do escopo do perfil',
  })
  @RequirePermissao('solicitacao', 'visualizar')
  @Get()
  listar(
    @Req() requisicao: RequisicaoAutenticada,
    @Query() query: ListarSolicitacoesQueryDto,
  ) {
    return this.solicitacoesService.listar(requisicao.user, query);
  }

  @RequirePermissao('solicitacao', 'visualizar')
  @Get(':id')
  buscarPorId(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
  ) {
    return this.solicitacoesService.buscarPorId(requisicao.user, paraId(id));
  }

  @RequirePermissao('solicitacao', 'editar')
  @Patch(':id')
  atualizar(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: AtualizarSolicitacaoDto,
  ) {
    return this.solicitacoesService.atualizar(requisicao.user, paraId(id), dto);
  }

  @RequirePermissao('solicitacao', 'editar')
  @HttpCode(HttpStatus.OK)
  @Post(':id/submeter')
  submeter(@Req() requisicao: RequisicaoAutenticada, @Param('id') id: string) {
    return this.solicitacoesService.submeter(requisicao.user, paraId(id));
  }

  @RequirePermissao('orcamento', 'editar')
  @Patch(':id/orcamentos/:orcamentoId')
  atualizarOrcamento(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Param('orcamentoId') orcamentoId: string,
    @Body() dto: AtualizarOrcamentoDto,
  ) {
    return this.solicitacoesService.atualizarOrcamento(
      requisicao.user,
      paraId(id),
      paraId(orcamentoId),
      dto,
    );
  }

  @RequirePermissao('solicitacao', 'reprovar')
  @HttpCode(HttpStatus.OK)
  @Post(':id/devolver-correcao')
  devolverCorrecao(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: DevolverCorrecaoDto,
  ) {
    return this.solicitacoesService.devolverCorrecao(
      requisicao.user,
      paraId(id),
      dto,
    );
  }

  @RequirePermissao('solicitacao', 'cancelar')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancelar')
  cancelar(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: CancelarSolicitacaoDto,
  ) {
    return this.solicitacoesService.cancelar(requisicao.user, paraId(id), dto);
  }
}
