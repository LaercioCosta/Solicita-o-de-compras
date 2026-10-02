export type Perfil =
  | 'SOLICITANTE'
  | 'GERENTE'
  | 'GERENTE_FINANCEIRA'
  | 'FINANCEIRO'
  | 'TI'
  | 'ADMINISTRADOR'

export type EstadoSolicitacao =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO_SETOR'
  | 'AGUARDANDO_APROVACAO_FINANCEIRA'
  | 'APROVADO'
  | 'AGUARDANDO_TI'
  | 'COMPRA_EM_ANDAMENTO'
  | 'AGUARDANDO_FINANCEIRO'
  | 'PAGO'
  | 'AGUARDANDO_NF'
  | 'CONCLUIDO'
  | 'REPROVADO'
  | 'CANCELADO'
  | 'AGUARDANDO_CORRECAO'

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: Perfil
  setorId: string
}

export interface Sessao {
  accessToken: string
  refreshToken: string
  usuario: Usuario
}

export interface RespostaLogin extends Sessao {}

export interface RespostaRefresh {
  accessToken: string
  refreshToken: string
}

export interface Notificacao {
  id: string
  mensagem: string
  lida: boolean
  lidaEm: string | null
  createdAt: string
  solicitacaoId: string
}

export interface ItemSolicitacao {
  id: string
  produto: string
  quantidade: number
  valorUnitarioEstimado: string | number
  createdAt: string
}

export interface Orcamento {
  id: string
  linkLoja: string
  cnpjLoja: string
  valor: string | number
  validadeAte: string | null
  createdAt: string
}

export interface ContadoresSolicitacao {
  orcamentos: number
  itens: number
}

export interface SetorResumo {
  id: string
  slug: string
  nome: string
}

export type TipoDocumento = 'ORCAMENTO' | 'COMPROVANTE_PAGAMENTO' | 'NOTA_FISCAL'

export interface DocumentoSolicitacao {
  id: string
  tipo: TipoDocumento
  nomeOriginal: string
  mimeType: string
  tamanhoBytes: number
}

export type FormaPagamento = 'BOLETO' | 'PIX'

export interface PagamentoInfo {
  id: string
  forma: FormaPagamento
  dados: string
  valorPago: string | null
  pagoEm: string | null
}

export interface CompraInfo {
  id: string
  orcamentoId: string
}

export interface DocumentoComprovante {
  id: string
  nomeOriginal: string
}

export interface RespostaPagamento {
  pagamento: PagamentoInfo
  documento: DocumentoComprovante
}

export interface SolicitacaoResumo {
  id: string
  descricao: string
  status: EstadoSolicitacao
  cicloAprovacao: number
  solicitanteId: string
  setorId: string
  motivoCancelamento: string | null
  createdAt: string
  updatedAt: string
  setor?: SetorResumo | null
  _count: ContadoresSolicitacao
}

export interface SolicitacaoDetalhe extends SolicitacaoResumo {
  itens: ItemSolicitacao[]
  orcamentos: Orcamento[]
  documentos?: DocumentoSolicitacao[]
  compra?: CompraInfo | null
  pagamento?: PagamentoInfo | null
}

export interface DocumentoBaixado {
  blob: Blob
  nomeArquivo: string
}

export interface CorpoErroApi {
  message: string | string[]
  error?: string
  statusCode?: number
}
