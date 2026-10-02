import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AtualizarSetorDto {
  @IsOptional()
  @IsString({ message: 'nome deve ser um texto' })
  @IsNotEmpty({ message: 'nome não pode ser vazio' })
  nome?: string;
}
