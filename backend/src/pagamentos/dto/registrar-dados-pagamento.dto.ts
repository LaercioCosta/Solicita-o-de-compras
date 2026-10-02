import { IsIn, IsString, Length } from 'class-validator';

export class RegistrarDadosPagamentoDto {
  @IsIn(['BOLETO', 'PIX'], { message: 'forma deve ser BOLETO ou PIX' })
  forma: 'BOLETO' | 'PIX';

  @IsString({ message: 'dados deve ser um texto' })
  @Length(1, 10000, { message: 'dados deve ter entre 1 e 10000 caracteres' })
  dados: string;
}
