import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { JwtPayload } from './jwt-payload.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

type RequisicaoAutenticada = Request & { user?: UsuarioAutenticado };

function extrairTokenBearer(
  cabecalhoAuthorization: string | undefined,
): string | undefined {
  if (!cabecalhoAuthorization?.startsWith('Bearer ')) {
    return undefined;
  }
  const token = cabecalhoAuthorization.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}

function paraUsuarioAutenticado(payload: JwtPayload): UsuarioAutenticado {
  return {
    id: payload.sub,
    email: payload.email,
    perfil: payload.perfil,
    setorId: payload.setorId,
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = extrairTokenBearer(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = paraUsuarioAutenticado(payload);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
