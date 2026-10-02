import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useContagemNotificacoes } from '../../layouts/NotificacoesContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import type { EstadoSolicitacao, Perfil, SolicitacaoResumo } from '../../types/api'

type Contagens = Partial<Record<EstadoSolicitacao, number>>

function useContagens(statuses: readonly EstadoSolicitacao[]) {
  const [contagens, setContagens] = useState<Contagens | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    Promise.all(
      statuses.map((status) =>
        api<SolicitacaoResumo[]>(`/solicitacoes?limit=100&status=${status}`).then(
          (lista) => [status, lista.length] as const,
        ),
      ),
    )
      .then((pares) => {
        if (!ativo) return
        const mapa: Contagens = {}
        for (const [status, total] of pares) {
          mapa[status] = total
        }
        setContagens(mapa)
      })
      .catch(() => {
        if (ativo) setErro(true)
      })
    return () => {
      ativo = false
    }
  }, [statuses])

  return { contagens, erro }
}

function CardContagem({
  titulo,
  contagem,
  carregando,
  para,
}: {
  titulo: string
  contagem: number | undefined
  carregando: boolean
  para: string
}) {
  return (
    <Link
      to={para}
      className="block rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-blue-400"
    >
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      {carregando ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 text-3xl font-bold text-slate-900">{contagem ?? 0}</p>
      )}
    </Link>
  )
}

const STATUS_SOLICITANTE = [
  'RASCUNHO',
  'AGUARDANDO_APROVACAO_SETOR',
  'AGUARDANDO_APROVACAO_FINANCEIRA',
  'CONCLUIDO',
] as const

const STATUS_GERENTE = ['AGUARDANDO_APROVACAO_SETOR'] as const

const STATUS_GF = ['AGUARDANDO_APROVACAO_FINANCEIRA', 'AGUARDANDO_FINANCEIRO'] as const

const STATUS_TI = ['AGUARDANDO_TI', 'COMPRA_EM_ANDAMENTO'] as const

const STATUS_FINANCEIRO = ['AGUARDANDO_FINANCEIRO'] as const

const ATALHOS: Record<Perfil, { to: string; rotulo: string }[]> = {
  SOLICITANTE: [
    { to: '/solicitacoes/nova', rotulo: 'Nova solicitação' },
    { to: '/solicitacoes', rotulo: 'Minhas solicitações' },
  ],
  GERENTE: [
    { to: '/aprovacoes', rotulo: 'Ver aprovações' },
    { to: '/solicitacoes', rotulo: 'Ver solicitações' },
  ],
  GERENTE_FINANCEIRA: [
    { to: '/aprovacoes', rotulo: 'Aprovações financeiras' },
    { to: '/pagamentos', rotulo: 'Pagamentos' },
  ],
  FINANCEIRO: [
    { to: '/pagamentos', rotulo: 'Pagamentos pendentes' },
    { to: '/solicitacoes', rotulo: 'Ver solicitações' },
  ],
  TI: [
    { to: '/ti', rotulo: 'Compras' },
    { to: '/notificacoes', rotulo: 'Notificações' },
  ],
  ADMINISTRADOR: [
    { to: '/admin/usuarios', rotulo: 'Usuários' },
    { to: '/admin/setores', rotulo: 'Setores' },
    { to: '/admin/auditoria', rotulo: 'Auditoria' },
  ],
}

function SecaoAtalhos({ perfil }: { perfil: Perfil }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-slate-500">Atalhos rápidos</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {ATALHOS[perfil].map((atalho) => (
          <Link
            key={atalho.to}
            to={atalho.to}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {atalho.rotulo}
          </Link>
        ))}
      </div>
    </section>
  )
}

function PainelContagens({
  statuses,
  cards,
}: {
  statuses: readonly EstadoSolicitacao[]
  cards: { titulo: string; status: EstadoSolicitacao }[]
}) {
  const { contagens, erro } = useContagens(statuses)
  const carregando = contagens === null
  if (erro) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar as contagens.</p>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <CardContagem
          key={card.status}
          titulo={card.titulo}
          contagem={contagens?.[card.status]}
          carregando={carregando}
          para={`/solicitacoes?status=${card.status}`}
        />
      ))}
    </div>
  )
}

function DashboardSolicitante() {
  return (
    <PainelContagens
      statuses={STATUS_SOLICITANTE}
      cards={[
        { titulo: 'Rascunhos', status: 'RASCUNHO' },
        { titulo: 'Aguardando aprovação do setor', status: 'AGUARDANDO_APROVACAO_SETOR' },
        { titulo: 'Aguardando aprovação financeira', status: 'AGUARDANDO_APROVACAO_FINANCEIRA' },
        { titulo: 'Concluídas', status: 'CONCLUIDO' },
      ]}
    />
  )
}

function DashboardGerente() {
  return (
    <PainelContagens
      statuses={STATUS_GERENTE}
      cards={[{ titulo: 'Pendências de aprovação', status: 'AGUARDANDO_APROVACAO_SETOR' }]}
    />
  )
}

function DashboardGerenteFinanceira() {
  return (
    <PainelContagens
      statuses={STATUS_GF}
      cards={[
        { titulo: 'Aguardando aprovação financeira', status: 'AGUARDANDO_APROVACAO_FINANCEIRA' },
        { titulo: 'Pagamentos pendentes', status: 'AGUARDANDO_FINANCEIRO' },
      ]}
    />
  )
}

function DashboardTi() {
  const { contagens, erro } = useContagens(STATUS_TI)
  const { naoLidas } = useContagemNotificacoes()
  if (erro) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar as contagens.</p>
    )
  }
  const carregando = contagens === null
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CardContagem
        titulo="Aprovadas para comprar"
        contagem={contagens?.['AGUARDANDO_TI']}
        carregando={carregando}
        para="/solicitacoes?status=AGUARDANDO_TI"
      />
      <CardContagem
        titulo="Compras em andamento"
        contagem={contagens?.['COMPRA_EM_ANDAMENTO']}
        carregando={carregando}
        para="/solicitacoes?status=COMPRA_EM_ANDAMENTO"
      />
      <CardContagem titulo="Notificações não lidas" contagem={naoLidas} carregando={false} para="/notificacoes" />
    </div>
  )
}

function DashboardFinanceiro() {
  return (
    <PainelContagens
      statuses={STATUS_FINANCEIRO}
      cards={[{ titulo: 'Aguardando pagamento', status: 'AGUARDANDO_FINANCEIRO' }]}
    />
  )
}

function DashboardAdministrador() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ATALHOS.ADMINISTRADOR.map((atalho) => (
        <Link
          key={atalho.to}
          to={atalho.to}
          className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-blue-400"
        >
          <p className="text-base font-semibold text-slate-900">{atalho.rotulo}</p>
          <p className="mt-1 text-sm text-slate-500">Gerenciar {atalho.rotulo.toLowerCase()}</p>
        </Link>
      ))}
    </div>
  )
}

const PAINEL_POR_PERFIL: Record<Perfil, ComponentType> = {
  SOLICITANTE: DashboardSolicitante,
  GERENTE: DashboardGerente,
  GERENTE_FINANCEIRA: DashboardGerenteFinanceira,
  FINANCEIRO: DashboardFinanceiro,
  TI: DashboardTi,
  ADMINISTRADOR: DashboardAdministrador,
}

export default function DashboardPage() {
  const { usuario } = useAuth()
  if (!usuario) return null
  const Painel = PAINEL_POR_PERFIL[usuario.perfil]
  return (
    <div>
      <PageHeader titulo="Dashboard" descricao={`Bem-vindo(a), ${usuario.nome}.`} />
      <div className="mt-6">
        <Painel />
      </div>
      <SecaoAtalhos perfil={usuario.perfil} />
    </div>
  )
}
