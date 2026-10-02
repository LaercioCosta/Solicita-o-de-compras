import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PerfilUsuario, SetorSlug } from '../../generated/prisma/enums.js';

export class CriarUsuarioDto {
  @IsString({ message: 'nome deve ser um texto' })
  @IsNotEmpty({ message: 'nome é obrigatório' })
  nome: string;

  @IsEmail({}, { message: 'email deve ser um endereço de e-mail válido' })
  email: string;

  @IsString({ message: 'senha deve ser um texto' })
  @MinLength(8, { message: 'senha deve ter no mínimo 8 caracteres' })
  senha: string;

  @IsEnum(PerfilUsuario, { message: 'perfil inválido' })
  perfil: PerfilUsuario;

  @IsEnum(SetorSlug, { message: 'setor inválido' })
  setor: SetorSlug;
}
