import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUrl,
  Matches,
} from 'class-validator';

export class CriarOrcamentoDto {
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { message: 'linkLoja deve ser uma URL http/https válida' },
  )
  linkLoja: string;

  @Matches(/^\d{14}$/, {
    message: 'cnpjLoja deve conter exatamente 14 dígitos',
  })
  cnpjLoja: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'valor deve ser um número com no máximo 2 casas decimais' },
  )
  @IsPositive({ message: 'valor deve ser maior que zero' })
  valor: number;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'validadeAte deve ser uma data ISO 8601 válida' },
  )
  validadeAte?: string;
}
