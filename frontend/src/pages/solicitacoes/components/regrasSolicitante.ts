import type { EstadoSolicitacao, SolicitacaoDetalhe, Usuario } from '../../../types/api'

export const STATUS_EDICAO_LIVRE: EstadoSolicitacao[] = ['RASCUNHO', 'AGUARDANDO_CORRECAO']

export const STATUS_PRE_COMPRA: EstadoSolicitacao[] = [
  'AGUARDANDO_APROVACAO_SETOR',
  'AGUARDANDO_APROVACAO_FINANCEIRA',
  'APROVADO',
  'AGUARDANDO_TI',
]

export function eDonoSolicitante(usuario: Usuario | null, solicitacao: SolicitacaoDetalhe): boolean {
  return usuario?.perfil === 'SOLICITANTE' && usuario.id === solicitacao.solicitanteId
}

export function podeAnexarDocumentoOrcamento(status: EstadoSolicitacao): boolean {
  return STATUS_EDICAO_LIVRE.includes(status) || STATUS_PRE_COMPRA.includes(status)
}

export function reabreCicloAprovacao(status: EstadoSolicitacao): boolean {
  return STATUS_PRE_COMPRA.includes(status)
}
