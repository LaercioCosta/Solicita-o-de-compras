import { Module } from '@nestjs/common';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { PagamentosController } from './pagamentos.controller.js';
import { PagamentosService } from './pagamentos.service.js';

@Module({
  imports: [DocumentosModule],
  controllers: [PagamentosController],
  providers: [PagamentosService],
})
export class PagamentosModule {}
