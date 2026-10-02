import { IsString, Length } from 'class-validator';

export class CancelarSolicitacaoDto {
  @IsString({ message: 'motivo deve ser um texto' })
  @Length(1, 1000, { message: 'motivo deve ter entre 1 e 1000 caracteres' })
  motivo: string;
}
