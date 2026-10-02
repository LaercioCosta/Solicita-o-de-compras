import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Coluna } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SkeletonLinhas } from '../../components/ui/Skeleton'
import { formatarDataHora } from '../../lib/format'
import type { EstadoSolicitacao, SolicitacaoDetalhe, SolicitacaoResumo } from '../../types/api'
import { PainelDecisao, type NivelAprovacao } from './components/PainelDecisao'

const STATUS_POR_NIVEL: Record<NivelAprovacao, EstadoSolicitacao> = {
  SETOR: 'AGUARDANDO_APROVACAO_SETOR',
  FINANCEIRA: 'AGUARDANDO_APROVACAO_FINANCEIRA',
}

const ABAS: Array<{ nivel: NivelAprovacao; rotulo: string; somenteFinanceira: boolean }> = [
  { nivel: 'SETOR', rotulo: 'Aprovação de setor', somenteFinanceira: false },
  { nivel: 'FINANCEIRA', rotulo: 'Aprovação financeira', somenteFinanceira: true },
]

const AVISO_PRIMEIRO_NIVEL = 'Você aprova o 1º nível apenas nos setores Oficina e TI.'

interface EstadoAnalise {
  resumo: SolicitacaoResumo
  detalhe: SolicitacaoDetalhe | null
  erro: boolean
}

interface EstadoFila {
  chave: string
  itens: SolicitacaoResumo[] | null
  erro: boolean
}

interface PropsModalAnalise {
  aberto: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
}

function ModalAnalise({ aberto, titulo, aoFechar, children }: PropsModalAnalise) {
  useEffect(() => {
    if (!aberto) return
    const aoPressionarEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoPressionarEsc)
    return () => window.removeEventListener('keydown', aoPressionarEsc)
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10"
      onClick={aoFechar}
    >
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl" onClick={(evento) => evento.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={aoFechar}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="mt-4 text-sm text-slate-600">{children}</div>
      </div>
    </div>
  )
}

export default function AprovacoesPage() {
  const { usuario } = useAuth()
  const ehFinanceira = usuario?.perfil === 'GERENTE_FINANCEIRA'
  const [aba, setAba] = useState<NivelAprovacao>(() => (ehFinanceira ? 'FINANCEIRA' : 'SETOR'))
  const [versao, setVersao] = useState(0)
  const [estado, setEstado] = useState<EstadoFila>({ chave: '', itens: null, erro: false })
  const [analise, setAnalise] = useState<EstadoAnalise | null>(null)

  const status = STATUS_POR_NIVEL[aba]
  const chaveAtual = `${status}|${versao}`

  useEffect(() => {
    let ativo = true
    api<SolicitacaoResumo[]>(`/solicitacoes?status=${status}&limit=50&offset=0`)
      .then((lista) => {
        if (ativo) setEstado({ chave: `${status}|${versao}`, itens: lista, erro: false })
      })
      .catch(() => {
        if (ativo) setEstado({ chave: `${status}|${versao}`, itens: null, erro: true })
      })
    return () => {
      ativo = false
    }
  }, [status, versao])

  const desatualizado = estado.chave !== chaveAtual
  const carregando = desatualizado || estado.itens === null
  const erroFila = !desatualizado && estado.erro
  const itens = !carregando && estado.itens ? estado.itens : []

  function abrirAnalise(resumo: SolicitacaoResumo) {
    setAnalise({ resumo, detalhe: null, erro: false })
    api<SolicitacaoDetalhe>(`/solicitacoes/${resumo.id}`)
      .then((detalhe) => {
        setAnalise((atual) =>
          atual !== null && atual.resumo.id === resumo.id ? { ...atual, detalhe, erro: false } : atual,
        )
      })
      .catch(() => {
        setAnalise((atual) =>
          atual !== null && atual.resumo.id === resumo.id ? { ...atual, erro: true } : atual,
        )
      })
  }

  function fecharAnalise() {
    setAnalise(null)
  }

  function aoConcluir() {
    fecharAnalise()
    setVersao((atual) => atual + 1)
  }

  function selecionarAba(nivel: NivelAprovacao) {
    if (nivel === aba) return
    fecharAnalise()
    setAba(nivel)
  }

  const colunas: Coluna<SolicitacaoResumo>[] = [
    {
      titulo: 'Solicitação',
      renderizar: (item) => (
        <div className="flex max-w-72 flex-col">
          <span className="font-medium text-slate-900">{item.id}</span>
          <span className="truncate text-xs text-slate-500">{item.descricao}</span>
        </div>
      ),
    },
    { titulo: 'Setor', renderizar: (item) => item.setor?.nome ?? '—' },
    { titulo: 'Itens', renderizar: (item) => item._count.itens },
    { titulo: 'Orçamentos', renderizar: (item) => item._count.orcamentos },
    { titulo: 'Atualizado em', renderizar: (item) => formatarDataHora(item.updatedAt) },
    {
      titulo: 'Ações',
      renderizar: (item) => (
        <Button variante="secundario" onClick={() => abrirAnalise(item)}>
          Analisar
        </Button>
      ),
    },
  ]

  const abasVisiveis = ABAS.filter((item) => !item.somenteFinanceira || ehFinanceira)

  return (
    <div>
      <PageHeader titulo="Aprovações" descricao="Pendências de decisão por nível de aprovação." />
      <div role="tablist" aria-label="Níveis de aprovação" className="mt-6 flex flex-wrap gap-2">
        {abasVisiveis.map((item) => (
          <button
            key={item.nivel}
            type="button"
            role="tab"
            aria-selected={aba === item.nivel}
            onClick={() => selecionarAba(item.nivel)}
            className={`rounded-md px-4 py-2 text-sm font-medium ring-1 transition ${
              aba === item.nivel
                ? 'bg-blue-600 text-white ring-blue-600'
                : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {aba === 'SETOR' && ehFinanceira ? (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset">
          {AVISO_PRIMEIRO_NIVEL}
        </p>
      ) : null}

      <Card className="mt-4">
        {erroFila ? (
          <p className="px-4 py-3 text-sm text-red-700">Não foi possível carregar as pendências.</p>
        ) : (
          <DataTable
            colunas={colunas}
            itens={itens}
            chave={(item) => item.id}
            carregando={carregando}
            vazio={
              <EmptyState
                titulo="Nada pendente — tudo em dia"
                descricao="Não há solicitações aguardando decisão neste nível."
              />
            }
          />
        )}
      </Card>

      <ModalAnalise
        aberto={analise !== null}
        titulo={analise ? `Analisar ${analise.resumo.id}` : ''}
        aoFechar={fecharAnalise}
      >
        {analise === null ? null : analise.detalhe !== null ? (
          <PainelDecisao solicitacao={analise.detalhe} nivel={aba} aoConcluir={aoConcluir} />
        ) : analise.erro ? (
          <p className="py-2 text-sm text-red-700">Não foi possível carregar a solicitação.</p>
        ) : (
          <SkeletonLinhas linhas={6} colunas={3} />
        )}
      </ModalAnalise>
    </div>
  )
}
