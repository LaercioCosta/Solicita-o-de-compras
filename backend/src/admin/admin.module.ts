import { Module } from '@nestjs/common';
import { ConsultaAuditoriaController } from './consulta-auditoria.controller.js';
import { ConsultaAuditoriaService } from './consulta-auditoria.service.js';
import { AdminSetoresController } from './setores.controller.js';
import { AdminSetoresService } from './setores.service.js';
import { AdminUsuariosController } from './usuarios.controller.js';
import { AdminUsuariosService } from './usuarios.service.js';

@Module({
  controllers: [
    AdminUsuariosController,
    AdminSetoresController,
    ConsultaAuditoriaController,
  ],
  providers: [AdminUsuariosService, AdminSetoresService, ConsultaAuditoriaService],
})
export class AdminModule {}
