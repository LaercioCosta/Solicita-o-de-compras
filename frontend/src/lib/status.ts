import type { EstadoSolicitacao } from '../types/api'

export const TODOS_STATUS: EstadoSolicitacao[] = [
  'RASCUNHO',
  'AGUARDANDO_APROVACAO_SETOR',
  'AGUARDANDO_APROVACAO_FINANCEIRA',
  'APROVADO',
  'AGUARDANDO_TI',
  'COMPRA_EM_ANDAMENTO',
  'AGUARDANDO_FINANCEIRO',
  'PAGO',
  'AGUARDANDO_NF',
  'CONCLUIDO',
  'REPROVADO',
  'CANCELADO',
  'AGUARDANDO_CORRECAO',
]

export const ROTULOS_STATUS: Record<EstadoSolicitacao, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO_SETOR: 'Aguardando aprovação do setor',
  AGUARDANDO_APROVACAO_FINANCEIRA: 'Aguardando aprovação financeira',
  APROVADO: 'Aprovado',
  AGUARDANDO_TI: 'Aguardando TI',
  COMPRA_EM_ANDAMENTO: 'Compra em andamento',
  AGUARDANDO_FINANCEIRO: 'Aguardando financeiro',
  PAGO: 'Pago',
  AGUARDANDO_NF: 'Aguardando NF',
  CONCLUIDO: 'Concluído',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
  AGUARDANDO_CORRECAO: 'Aguardando correção',
}

export type TomStatus = 'neutro' | 'azul' | 'verde' | 'vermelho' | 'cinza'

export const TONS_STATUS: Record<EstadoSolicitacao, TomStatus> = {
  RASCUNHO: 'neutro',
  AGUARDANDO_CORRECAO: 'neutro',
  AGUARDANDO_APROVACAO_SETOR: 'azul',
  AGUARDANDO_APROVACAO_FINANCEIRA: 'azul',
  AGUARDANDO_TI: 'azul',
  COMPRA_EM_ANDAMENTO: 'azul',
  AGUARDANDO_FINANCEIRO: 'azul',
  AGUARDANDO_NF: 'azul',
  APROVADO: 'verde',
  PAGO: 'verde',
  CONCLUIDO: 'verde',
  REPROVADO: 'vermelho',
  CANCELADO: 'cinza',
}

export const ORDEM_FLUXO: EstadoSolicitacao[] = [
  'RASCUNHO',
  'AGUARDANDO_CORRECAO',
  'AGUARDANDO_APROVACAO_SETOR',
  'AGUARDANDO_APROVACAO_FINANCEIRA',
  'APROVADO',
  'AGUARDANDO_TI',
  'COMPRA_EM_ANDAMENTO',
  'AGUARDANDO_FINANCEIRO',
  'PAGO',
  'AGUARDANDO_NF',
  'CONCLUIDO',
  'REPROVADO',
  'CANCELADO',
]

export function ehStatusValido(valor: string): valor is EstadoSolicitacao {
  return (TODOS_STATUS as string[]).includes(valor)
}
