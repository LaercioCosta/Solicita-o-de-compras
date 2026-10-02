import { Module } from '@nestjs/common';
import { ComprasController } from './compras.controller.js';
import { ComprasService } from './compras.service.js';

@Module({
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}
