import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { Public } from './public.decorator.js';
import { AuthService, type RespostaLogin, type RespostaRenovacao } from './auth.service.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e devolve par de tokens JWT' })
  @Post('login')
  login(@Body() dto: LoginDto): Promise<RespostaLogin> {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renova o par de tokens (refresh rotativo)' })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<RespostaRenovacao> {
    return this.authService.refresh(dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga a sessão do refresh token' })
  @Post('logout')
  logout(
    @Body() dto: RefreshDto,
    @Req() requisicao: RequisicaoAutenticada,
  ): Promise<void> {
    return this.authService.logout(dto, requisicao.user.id);
  }
}
