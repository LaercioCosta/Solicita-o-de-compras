import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissao } from '../auth/require-permissao.decorator.js';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { paraIdParametro } from '../comum/parametros.util.js';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto.js';
import { CriarUsuarioDto } from './dto/criar-usuario.dto.js';
import { AdminUsuariosService } from './usuarios.service.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@ApiTags('Usuários (Admin)')
@ApiBearerAuth()
@Controller('usuarios')
export class AdminUsuariosController {
  constructor(private readonly usuariosService: AdminUsuariosService) {}

  @RequirePermissao('usuario', 'criar')
  @ApiOperation({ summary: 'Cria um usuário (hash Argon2id; e-mail único)' })
  @Post()
  criar(
    @Req() requisicao: RequisicaoAutenticada,
    @Body() dto: CriarUsuarioDto,
  ) {
    return this.usuariosService.criar(requisicao.user, dto);
  }

  @RequirePermissao('usuario', 'visualizar')
  @ApiOperation({ summary: 'Lista usuários com perfil e setor' })
  @Get()
  listar() {
    return this.usuariosService.listar();
  }

  @RequirePermissao('usuario', 'visualizar')
  @ApiOperation({ summary: 'Detalha um usuário por id' })
  @Get(':id')
  buscarPorId(@Param('id') id: string) {
    return this.usuariosService.buscarPorId(
      paraIdParametro(id, 'Usuário não encontrado'),
    );
  }

  @RequirePermissao('usuario', 'editar')
  @ApiOperation({ summary: 'Edita usuário (nome, e-mail, perfil, setor, senha)' })
  @Patch(':id')
  atualizar(
    @Req() requisicao: RequisicaoAutenticada,
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
  ) {
    return this.usuariosService.atualizar(
      requisicao.user,
      paraIdParametro(id, 'Usuário não encontrado'),
      dto,
    );
  }
}
