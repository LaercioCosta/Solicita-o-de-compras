import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { PerfilUsuario, SetorSlug } from '../../generated/prisma/enums.js';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsString({ message: 'nome deve ser um texto' })
  @IsNotEmpty({ message: 'nome não pode ser vazio' })
  nome?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email deve ser um endereço de e-mail válido' })
  email?: string;

  @IsOptional()
  @IsEnum(PerfilUsuario, { message: 'perfil inválido' })
  perfil?: PerfilUsuario;

  @IsOptional()
  @IsEnum(SetorSlug, { message: 'setor inválido' })
  setor?: SetorSlug;

  @IsOptional()
  @IsString({ message: 'senha deve ser um texto' })
  @MinLength(8, { message: 'senha deve ter no mínimo 8 caracteres' })
  senha?: string;
}
