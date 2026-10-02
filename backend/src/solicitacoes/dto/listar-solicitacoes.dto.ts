import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EstadoSolicitacao } from '../../generated/prisma/enums.js';

export class ListarSolicitacoesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um inteiro entre 1 e 100' })
  @Min(1, { message: 'limit deve ser no mínimo 1' })
  @Max(100, { message: 'limit deve ser no máximo 100' })
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset deve ser um inteiro maior ou igual a zero' })
  @Min(0, { message: 'offset deve ser maior ou igual a zero' })
  offset = 0;

  @IsOptional()
  @IsEnum(EstadoSolicitacao, {
    message: 'status deve ser um estado de solicitação válido',
  })
  status?: EstadoSolicitacao;
}
