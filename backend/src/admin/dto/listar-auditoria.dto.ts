import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AcaoAuditoria } from '../../generated/prisma/enums.js';

export class ListarAuditoriaQueryDto {
  @IsOptional()
  @IsString({ message: 'entidade deve ser um texto' })
  entidade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'entidadeId deve ser um inteiro maior que zero' })
  @Min(1, { message: 'entidadeId deve ser maior que zero' })
  entidadeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'usuarioId deve ser um inteiro maior que zero' })
  @Min(1, { message: 'usuarioId deve ser maior que zero' })
  usuarioId?: number;

  @IsOptional()
  @IsEnum(AcaoAuditoria, { message: 'acao inválida' })
  acao?: AcaoAuditoria;

  @IsOptional()
  @IsString({ message: 'estadoNovo deve ser um texto' })
  estadoNovo?: string;

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
}
