import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaService } from './sla.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
