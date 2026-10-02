import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { SolicitacaoItemDto } from './criar-solicitacao.dto.js';

export class AtualizarSolicitacaoDto {
  @IsOptional()
  @IsString({ message: 'descricao deve ser um texto' })
  @Length(1, 2000, { message: 'descricao deve ter entre 1 e 2000 caracteres' })
  descricao?: string;

  @IsOptional()
  @IsArray({ message: 'itens deve ser uma lista' })
  @ArrayMinSize(1, { message: 'itens deve ter ao menos 1 item' })
  @ArrayMaxSize(50, { message: 'itens deve ter no máximo 50 itens' })
  @ValidateNested({ each: true, message: 'item inválido em itens' })
  @Type(() => SolicitacaoItemDto)
  itens?: SolicitacaoItemDto[];
}
