import type { Perfil } from '../types/api'

export type Capacidade =
  | 'solicitacoes'
  | 'novaSolicitacao'
  | 'aprovacoes'
  | 'comprasTi'
  | 'pagamentos'
  | 'adminUsuarios'
  | 'adminSetores'
  | 'auditoria'

export interface ItemNav {
  to: string
  rotulo: string
  capacidade?: Capacidade
  comBadge?: boolean
}

const CAPACIDADES_POR_PERFIL: Record<Perfil, Capacidade[]> = {
  SOLICITANTE: ['solicitacoes', 'novaSolicitacao'],
  GERENTE: ['solicitacoes', 'aprovacoes'],
  GERENTE_FINANCEIRA: ['solicitacoes', 'aprovacoes', 'pagamentos'],
  FINANCEIRO: ['solicitacoes', 'pagamentos'],
  TI: ['solicitacoes', 'comprasTi'],
  ADMINISTRADOR: ['adminUsuarios', 'adminSetores', 'auditoria'],
}

export function temCapacidade(perfil: Perfil, capacidade: Capacidade): boolean {
  return CAPACIDADES_POR_PERFIL[perfil].includes(capacidade)
}

export const ROTULOS_PERFIL: Record<Perfil, string> = {
  SOLICITANTE: 'Solicitante',
  GERENTE: 'Gerente',
  GERENTE_FINANCEIRA: 'Gerente Financeira',
  FINANCEIRO: 'Financeiro',
  TI: 'TI',
  ADMINISTRADOR: 'Administrador',
}

export function itensNavPara(perfil: Perfil): ItemNav[] {
  const itens: ItemNav[] = [
    { to: '/', rotulo: 'Dashboard' },
    {
      to: '/solicitacoes',
      rotulo: perfil === 'SOLICITANTE' ? 'Minhas solicitações' : 'Solicitações',
      capacidade: 'solicitacoes',
    },
    { to: '/solicitacoes/nova', rotulo: 'Nova solicitação', capacidade: 'novaSolicitacao' },
    {
      to: '/aprovacoes',
      rotulo: perfil === 'GERENTE_FINANCEIRA' ? 'Aprovações financeiras' : 'Aprovações',
      capacidade: 'aprovacoes',
    },
    { to: '/ti', rotulo: 'Compras', capacidade: 'comprasTi' },
    { to: '/pagamentos', rotulo: 'Pagamentos', capacidade: 'pagamentos' },
    { to: '/admin/usuarios', rotulo: 'Usuários', capacidade: 'adminUsuarios' },
    { to: '/admin/setores', rotulo: 'Setores', capacidade: 'adminSetores' },
    { to: '/admin/auditoria', rotulo: 'Auditoria', capacidade: 'auditoria' },
    { to: '/notificacoes', rotulo: 'Notificações', comBadge: true },
  ]
  return itens.filter(
    (item) => item.capacidade === undefined || temCapacidade(perfil, item.capacidade),
  )
}
