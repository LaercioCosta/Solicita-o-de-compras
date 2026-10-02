import type { EstadoSolicitacao } from '../../../types/api'

export type AcaoTi = 'COMPRAR' | 'PAGAMENTO' | 'NF'

export function acaoTiParaStatus(status: EstadoSolicitacao): AcaoTi | null {
  if (status === 'APROVADO') return 'COMPRAR'
  if (status === 'COMPRA_EM_ANDAMENTO') return 'PAGAMENTO'
  if (status === 'PAGO' || status === 'AGUARDANDO_NF') return 'NF'
  return null
}

export const ROTULOS_ACAO_TI: Record<AcaoTi, string> = {
  COMPRAR: 'Executar compra',
  PAGAMENTO: 'Registrar dados de pagamento',
  NF: 'Anexar nota fiscal',
}
