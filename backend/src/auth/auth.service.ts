import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { PerfilUsuario } from '../generated/prisma/enums.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import { JWT_REFRESH_SERVICE } from './jwt-refresh.js';
import type { JwtPayload, RefreshTokenPayload } from './jwt-payload.js';

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  setorId: number;
}

export interface RespostaLogin {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioLogado;
}

export interface RespostaRenovacao {
  accessToken: string;
  refreshToken: string;
}

async function senhaCorresponde(
  senhaHash: string | undefined,
  senha: string,
): Promise<boolean> {
  const hashAlvo = senhaHash ?? (await hash('credenciais-invalidas'));
  return verify(hashAlvo, senha);
}

function hashSha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(JWT_REFRESH_SERVICE)
    private readonly jwtRefreshService: JwtService,
  ) {}

  private async emitirParTokens(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string; expiraEm: Date }> {
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtRefreshService.signAsync({
      sub: payload.sub,
      typ: 'refresh',
      jti: randomUUID(),
    });
    const decodificado = this.jwtRefreshService.decode(refreshToken) as {
      exp: number;
    };

    return {
      accessToken,
      refreshToken,
      expiraEm: new Date(decodificado.exp * 1000),
    };
  }

  private async buscarUsuarioPorEmail(email: string) {
    return this.prisma.usuario.findUnique({
      where: { email },
      include: { perfil: { select: { slug: true } } },
    });
  }

  private async verificarRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload =
        await this.jwtRefreshService.verifyAsync<RefreshTokenPayload>(
          refreshToken,
        );

      if (payload.typ !== 'refresh' || typeof payload.sub !== 'number') {
        throw new UnauthorizedException('Refresh token inválido');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  async login(dto: LoginDto): Promise<RespostaLogin> {
    const usuario = await this.buscarUsuarioPorEmail(dto.email);
    const senhaValida = await senhaCorresponde(usuario?.senhaHash, dto.senha);

    if (!usuario || !senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const { accessToken, refreshToken, expiraEm } = await this.emitirParTokens({
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil.slug,
      setorId: usuario.setorId,
    });

    await this.prisma.sessao.create({
      data: {
        usuarioId: usuario.id,
        refreshTokenHash: hashSha256(refreshToken),
        expiraEm,
      },
    });

    return {
      accessToken,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil.slug,
        setorId: usuario.setorId,
      },
    };
  }

  async refresh(dto: RefreshDto): Promise<RespostaRenovacao> {
    await this.verificarRefreshToken(dto.refreshToken);

    const sessao = await this.prisma.sessao.findUnique({
      where: { refreshTokenHash: hashSha256(dto.refreshToken) },
    });
    const agora = new Date();

    if (!sessao || sessao.revogadaEm !== null || sessao.expiraEm <= agora) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: sessao.usuarioId },
      include: { perfil: { select: { slug: true } } },
    });

    if (!usuario) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const { accessToken, refreshToken, expiraEm } = await this.emitirParTokens({
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil.slug,
      setorId: usuario.setorId,
    });
    const idSessaoAtual = sessao.id;
    const idUsuario = usuario.id;
    const novoHash = hashSha256(refreshToken);

    await this.prisma.$transaction(async (tx) => {
      const revogada = await tx.sessao.updateMany({
        where: { id: idSessaoAtual, revogadaEm: null },
        data: { revogadaEm: agora },
      });

      if (revogada.count !== 1) {
        throw new UnauthorizedException('Refresh token revogado');
      }

      await tx.sessao.create({
        data: {
          usuarioId: idUsuario,
          refreshTokenHash: novoHash,
          expiraEm,
        },
      });
    });

    return { accessToken, refreshToken };
  }

  async logout(dto: RefreshDto, usuarioId: number): Promise<void> {
    await this.prisma.sessao.updateMany({
      where: {
        refreshTokenHash: hashSha256(dto.refreshToken),
        usuarioId,
        revogadaEm: null,
      },
      data: { revogadaEm: new Date() },
    });
  }
}
