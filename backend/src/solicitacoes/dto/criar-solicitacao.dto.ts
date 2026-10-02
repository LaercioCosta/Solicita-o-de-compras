import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class SolicitacaoItemDto {
  @IsString({ message: 'produto deve ser um texto' })
  @Length(1, 500, { message: 'produto deve ter entre 1 e 500 caracteres' })
  produto: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'quantidade deve ser um número com no máximo 2 casas decimais',
    },
  )
  @IsPositive({ message: 'quantidade deve ser maior que zero' })
  quantidade: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'valorUnitarioEstimado deve ser um número com no máximo 2 casas decimais',
    },
  )
  @IsPositive({ message: 'valorUnitarioEstimado deve ser maior que zero' })
  valorUnitarioEstimado: number;
}

export class CriarSolicitacaoDto {
  @IsString({ message: 'descricao deve ser um texto' })
  @Length(1, 2000, { message: 'descricao deve ter entre 1 e 2000 caracteres' })
  descricao: string;

  @IsArray({ message: 'itens deve ser uma lista' })
  @ArrayMinSize(1, { message: 'itens deve ter ao menos 1 item' })
  @ArrayMaxSize(50, { message: 'itens deve ter no máximo 50 itens' })
  @ValidateNested({ each: true, message: 'item inválido em itens' })
  @Type(() => SolicitacaoItemDto)
  itens: SolicitacaoItemDto[];
}
