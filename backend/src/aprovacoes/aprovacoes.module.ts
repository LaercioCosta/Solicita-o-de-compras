import { Module } from '@nestjs/common';
import { NotificacoesModule } from '../notificacoes/notificacoes.module.js';
import { AprovacoesController } from './aprovacoes.controller.js';
import { AprovacoesService } from './aprovacoes.service.js';

@Module({
  imports: [NotificacoesModule],
  controllers: [AprovacoesController],
  providers: [AprovacoesService],
})
export class AprovacoesModule {}
