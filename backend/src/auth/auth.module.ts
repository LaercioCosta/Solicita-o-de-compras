import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import {
  JWT_REFRESH_SERVICE,
  criarJwtRefreshService,
} from './jwt-refresh.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;

        if (!secret) {
          throw new Error('JWT_SECRET não definida — verifique backend/.env');
        }

        return { secret, signOptions: { expiresIn: '15m' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: JWT_REFRESH_SERVICE, useFactory: criarJwtRefreshService },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
