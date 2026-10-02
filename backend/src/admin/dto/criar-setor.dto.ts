import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { SetorSlug } from '../../generated/prisma/enums.js';

export class CriarSetorDto {
  @IsEnum(SetorSlug, { message: 'slug inválido' })
  slug: SetorSlug;

  @IsString({ message: 'nome deve ser um texto' })
  @IsNotEmpty({ message: 'nome é obrigatório' })
  nome: string;
}
