import { SetMetadata } from '@nestjs/common';

export interface PermissaoExigida {
  entidade: string;
  acao: string;
}

export const PERMISSAO_KEY = 'permissaoExigida';

export const RequirePermissao = (entidade: string, acao: string) =>
  SetMetadata(PERMISSAO_KEY, { entidade, acao } satisfies PermissaoExigida);
