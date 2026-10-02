import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service.js';
import {
  PERMISSAO_KEY,
  type PermissaoExigida,
} from './require-permissao.decorator.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

type RequisicaoAutenticada = Request & { user: UsuarioAutenticado };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissao = this.reflector.getAllAndOverride<
      PermissaoExigida | undefined
    >(PERMISSAO_KEY, [context.getHandler(), context.getClass()]);

    if (!permissao) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const permitida = await this.prisma.permissao.findFirst({
      where: {
        perfil: { slug: request.user.perfil },
        entidade: permissao.entidade,
        acao: permissao.acao,
        permitida: true,
      },
      select: { id: true },
    });

    if (!permitida) {
      throw new ForbiddenException();
    }

    return true;
  }
}
