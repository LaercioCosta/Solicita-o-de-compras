import { IsIn, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class DecisaoAprovacaoDto {
  @IsInt({ message: 'orcamentoId deve ser um número inteiro' })
  orcamentoId: number;

  @IsIn(['APROVADO', 'REPROVADO'], {
    message: 'decisao deve ser APROVADO ou REPROVADO',
  })
  decisao: 'APROVADO' | 'REPROVADO';

  @IsOptional()
  @IsString({ message: 'observacao deve ser um texto' })
  @Length(1, 1000, {
    message: 'observacao deve ter entre 1 e 1000 caracteres',
  })
  observacao?: string;
}
