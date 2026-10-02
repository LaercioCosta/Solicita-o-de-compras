import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AdminModule } from './admin/admin.module.js';
import { AprovacoesModule } from './aprovacoes/aprovacoes.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ComprasModule } from './compras/compras.module.js';
import { DocumentosModule } from './documentos/documentos.module.js';
import { NotificacoesModule } from './notificacoes/notificacoes.module.js';
import { PagamentosModule } from './pagamentos/pagamentos.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { SlaModule } from './sla/sla.module.js';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditoriaModule,
    AdminModule,
    SolicitacoesModule,
    AprovacoesModule,
    NotificacoesModule,
    ComprasModule,
    DocumentosModule,
    PagamentosModule,
    SlaModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
