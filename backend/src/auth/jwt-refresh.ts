import { JwtService } from '@nestjs/jwt';

export const JWT_REFRESH_SERVICE = Symbol('JWT_REFRESH_SERVICE');

export function criarJwtRefreshService(): JwtService {
  const secret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET não definida — verifique backend/.env');
  }

  return new JwtService({
    secret,
    signOptions: { expiresIn: '7d', audience: 'refresh' },
    verifyOptions: { audience: 'refresh' },
  });
}
