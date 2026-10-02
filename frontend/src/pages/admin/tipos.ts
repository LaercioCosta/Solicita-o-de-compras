import type { TomBadge } from '../../components/ui/Badge'
import type { Perfil } from '../../types/api'

export type SlugSetor = 'OFICINA' | 'TI' | 'MKT' | 'COMERCIAL'

export type AcaoAuditoria =
  | 'CRIAR'
  | 'SUBMETER'
  | 'APROVAR'
  | 'REPROVAR'
  | 'CORRIGIR'
  | 'COMPRAR'
  | 'PAGAR'
  | 'CONCLUIR'
  | 'CANCELAR'

export interface RefSetor {
  id: number
  slug: SlugSetor
  nome: string
}

export interface RefPerfil {
  id: number
  slug: Perfil
  nome: string
}

export interface UsuarioAdmin {
  id: number
  nome: string
  email: string
  perfilId: number
  setorId: number
  createdAt: string
  updatedAt: string
  perfil: RefPerfil
  setor: RefSetor
}

export interface SetorAdmin {
  id: number
  slug: SlugSetor
  nome: string
  descricao: string | null
  createdAt: string
  updatedAt: string
}

export interface RegistroAuditoria {
  id: number
  usuarioId: number
  perfil: Perfil
  acao: AcaoAuditoria
  entidade: string
  entidadeId: number
  estadoAnterior: string | null
  estadoNovo: string | null
  dados: unknown
  createdAt: string
  usuario: { nome: string; email: string }
}

export const SLUGS_SETOR: SlugSetor[] = ['OFICINA', 'TI', 'MKT', 'COMERCIAL']

export const ROTULOS_SETOR: Record<SlugSetor, string> = {
  OFICINA: 'Oficina',
  TI: 'TI',
  MKT: 'Marketing',
  COMERCIAL: 'Comercial',
}

export const ACOES_AUDITORIA: AcaoAuditoria[] = [
  'CRIAR',
  'SUBMETER',
  'APROVAR',
  'REPROVAR',
  'CORRIGIR',
  'COMPRAR',
  'PAGAR',
  'CONCLUIR',
  'CANCELAR',
]

export const ROTULOS_ACAO: Record<AcaoAuditoria, string> = {
  CRIAR: 'Criar',
  SUBMETER: 'Submeter',
  APROVAR: 'Aprovar',
  REPROVAR: 'Reprovar',
  CORRIGIR: 'Corrigir',
  COMPRAR: 'Comprar',
  PAGAR: 'Pagar',
  CONCLUIR: 'Concluir',
  CANCELAR: 'Cancelar',
}

export const TONS_ACAO: Record<AcaoAuditoria, TomBadge> = {
  CRIAR: 'azul',
  SUBMETER: 'azul',
  APROVAR: 'verde',
  REPROVAR: 'vermelho',
  CORRIGIR: 'ambar',
  COMPRAR: 'azul',
  PAGAR: 'verde',
  CONCLUIR: 'verde',
  CANCELAR: 'cinza',
}

export const ENTIDADES_AUDITORIA = [
  'usuario',
  'setor',
  'solicitacao',
  'orcamento',
  'compra',
  'pagamento',
]

export const ROTULOS_ENTIDADE: Record<string, string> = {
  usuario: 'Usuário',
  setor: 'Setor',
  solicitacao: 'Solicitação',
  orcamento: 'Orçamento',
  compra: 'Compra',
  pagamento: 'Pagamento',
}
