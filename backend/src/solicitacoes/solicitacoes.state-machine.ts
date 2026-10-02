import { ConflictException } from '@nestjs/common';
import type { EstadoSolicitacao } from '../generated/prisma/enums.js';

export const TRANSICOES_PERMITIDAS: Readonly<
  Record<EstadoSolicitacao, ReadonlyArray<EstadoSolicitacao>>
> = {
  RASCUNHO: ['AGUARDANDO_APROVACAO_SETOR', 'CANCELADO'],
  AGUARDANDO_APROVACAO_SETOR: [
    'AGUARDANDO_APROVACAO_FINANCEIRA',
    'REPROVADO',
    'AGUARDANDO_CORRECAO',
  ],
  AGUARDANDO_APROVACAO_FINANCEIRA: ['APROVADO', 'REPROVADO'],
  APROVADO: ['COMPRA_EM_ANDAMENTO'],
  AGUARDANDO_TI: [],
  COMPRA_EM_ANDAMENTO: ['AGUARDANDO_FINANCEIRO'],
  AGUARDANDO_FINANCEIRO: ['PAGO'],
  PAGO: ['CONCLUIDO'],
  AGUARDANDO_NF: [],
  CONCLUIDO: [],
  REPROVADO: [],
  CANCELADO: [],
  AGUARDANDO_CORRECAO: ['AGUARDANDO_APROVACAO_SETOR', 'CANCELADO'],
};

export const ESTADOS_EDITAVEIS: ReadonlyArray<EstadoSolicitacao> = [
  'RASCUNHO',
  'AGUARDANDO_CORRECAO',
];

export const ESTADOS_REABERTURA: ReadonlyArray<EstadoSolicitacao> = [
  'AGUARDANDO_APROVACAO_SETOR',
  'AGUARDANDO_APROVACAO_FINANCEIRA',
  'APROVADO',
  'AGUARDANDO_TI',
];

export const ESTADOS_VISIVEIS_FINANCEIRO: ReadonlyArray<EstadoSolicitacao> = [
  'AGUARDANDO_FINANCEIRO',
  'PAGO',
  'AGUARDANDO_NF',
  'CONCLUIDO',
];

export const ESTADOS_VISIVEIS_TI: ReadonlyArray<EstadoSolicitacao> = [
  'APROVADO',
  'AGUARDANDO_TI',
  'COMPRA_EM_ANDAMENTO',
  'AGUARDANDO_FINANCEIRO',
  'PAGO',
  'AGUARDANDO_NF',
  'CONCLUIDO',
];

export function validarTransicao(
  estadoAtual: EstadoSolicitacao,
  estadoDestino: EstadoSolicitacao,
): void {
  if (!TRANSICOES_PERMITIDAS[estadoAtual].includes(estadoDestino)) {
    throw new ConflictException(
      `Transição de estado inválida: ${estadoAtual} para ${estadoDestino}`,
    );
  }
}

export function validarEstadoEditavel(estadoAtual: EstadoSolicitacao): void {
  if (!ESTADOS_EDITAVEIS.includes(estadoAtual)) {
    throw new ConflictException(
      `A solicitação não pode ser alterada no estado ${estadoAtual}`,
    );
  }
}
