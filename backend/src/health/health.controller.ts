import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Verificação de disponibilidade' })
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
