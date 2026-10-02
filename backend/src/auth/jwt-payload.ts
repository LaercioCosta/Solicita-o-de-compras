import type { PerfilUsuario } from '../generated/prisma/enums.js';

export interface JwtPayload {
  sub: number;
  email: string;
  perfil: PerfilUsuario;
  setorId: number;
}

export interface RefreshTokenPayload {
  sub: number;
  typ: 'refresh';
  jti?: string;
}
