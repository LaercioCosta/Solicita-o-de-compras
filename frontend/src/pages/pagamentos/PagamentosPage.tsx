import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatarData } from '../../lib/format'
import { PainelPagador } from './components/PainelPagador'
import type { EstadoSolicitacao, SolicitacaoDetalhe, SolicitacaoResumo } from '../../types/api'

type Aba = 'fila' | 'historico'

interface ItemPagamento {
  resumo: SolicitacaoResumo
  detalhe: SolicitacaoDetalhe | null
  falhaDetalhe: boolean
}

const STATUS_POR_ABA: Record<Aba, EstadoSolicitacao[]> = {
  fila: ['AGUARDANDO_FINANCEIRO'],
  historico: ['PAGO', 'CONCLUIDO'],
}

const classeAba = (ativa: boolean) =>
  `rounded-md px-4 py-2 text-sm font-medium transition ${
    ativa ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
  }`

function CabecalhoItem({ resumo }: { resumo: SolicitacaoResumo }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/solicitacoes/${resumo.id}`}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          {resumo.descricao}
        </Link>
        <StatusBadge status={resumo.status} />
      </div>
      <span className="text-xs text-slate-500">Aberta em {formatarData(resumo.createdAt)}</span>
    </div>
  )
}

function SkeletonFila() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((indice) => (
        <Card key={indice} className="flex flex-col gap-3 p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-12 w-full" />
        </Card>
      ))}
    </div>
  )
}

export default function PagamentosPage() {
  const { usuario } = useAuth()
  const podePagar = usuario?.perfil === 'GERENTE_FINANCEIRA' || usuario?.perfil === 'FINANCEIRO'
  const [aba, setAba] = useState<Aba>('fila')
  const [fila, setFila] = useState<ItemPagamento[] | null>(null)
  const [historico, setHistorico] = useState<ItemPagamento[] | null>(null)
  const [falhas, setFalhas] = useState<Record<Aba, boolean>>({ fila: false, historico: false })
  const [tentativa, setTentativa] = useState(0)

  const removerDaFila = useCallback((id: string) => {
    setFila((atual) => (atual === null ? atual : atual.filter((item) => item.resumo.id !== id)))
  }, [])

  useEffect(() => {
    if ((aba === 'fila' ? fila : historico) !== null) return
    let ativo = true
    const destino = aba === 'fila' ? setFila : setHistorico
    Promise.all(
      STATUS_POR_ABA[aba].map((status) =>
        api<SolicitacaoResumo[]>(`/solicitacoes?status=${status}`),
      ),
    )
      .then(async (grupos) => {
        const resumos = grupos.flat().sort((a, b) => Number(b.id) - Number(a.id))
        const itens = await Promise.all(
          resumos.map(async (resumo) => {
            try {
              const detalhe = await api<SolicitacaoDetalhe>(`/solicitacoes/${resumo.id}`)
              return { resumo, detalhe, falhaDetalhe: false } satisfies ItemPagamento
            } catch {
              return { resumo, detalhe: null, falhaDetalhe: true } satisfies ItemPagamento
            }
          }),
        )
        if (ativo) destino(itens)
      })
      .catch(() => {
        if (ativo) setFalhas((atuais) => ({ ...atuais, [aba]: true }))
      })
    return () => {
      ativo = false
    }
  }, [aba, fila, historico, tentativa])

  const falhaCarga = falhas[aba]
  const listaAtual = aba === 'fila' ? fila : historico
  const itensProntos = listaAtual !== null && !falhaCarga ? listaAtual : null
  const carregando = itensProntos === null

  function tentarNovamente() {
    setFalhas((atuais) => ({ ...atuais, [aba]: false }))
    setTentativa((atual) => atual + 1)
  }

  return (
    <div>
      <PageHeader
        titulo="Pagamentos"
        descricao="Registre os pagamentos das solicitações aprovadas anexando o comprovante."
        acoes={
          fila !== null ? (
            <Badge tom="azul">{fila.length} aguardando pagamento</Badge>
          ) : (
            <Skeleton className="h-6 w-40 rounded-full" />
          )
        }
      />
      <div className="mt-6 flex gap-2" role="tablist" aria-label="Abas de pagamentos">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'fila'}
          onClick={() => setAba('fila')}
          className={classeAba(aba === 'fila')}
        >
          Aguardando pagamento
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'historico'}
          onClick={() => setAba('historico')}
          className={classeAba(aba === 'historico')}
        >
          Histórico
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {falhaCarga ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
            <p className="text-sm text-red-700">Não foi possível carregar os pagamentos.</p>
            <Button variante="secundario" onClick={tentarNovamente}>
              Tentar novamente
            </Button>
          </Card>
        ) : carregando ? (
          <SkeletonFila />
        ) : itensProntos.length === 0 ? (
          <Card>
            {aba === 'fila' ? (
              <EmptyState
                titulo="Nenhum pagamento pendente"
                descricao="Não há solicitações aguardando pagamento no momento."
              />
            ) : (
              <EmptyState
                titulo="Nenhum pagamento no histórico"
                descricao="Nenhum pagamento foi registrado até agora."
              />
            )}
          </Card>
        ) : (
          itensProntos.map((item) =>
            aba === 'fila' ? (
              <div key={item.resumo.id} data-testid={`item-fila-${item.resumo.id}`}>
                <Card className="flex flex-col gap-4 p-4">
                  <CabecalhoItem resumo={item.resumo} />
                  {item.falhaDetalhe ? (
                    <p className="text-sm text-red-700">Não foi possível carregar os dados do pagamento.</p>
                  ) : (
                    <PainelPagador
                      pagamento={item.detalhe?.pagamento}
                      status={item.resumo.status}
                      podePagar={podePagar}
                      onPago={() => removerDaFila(item.resumo.id)}
                    />
                  )}
                </Card>
              </div>
            ) : (
              <div key={item.resumo.id} data-testid={`item-historico-${item.resumo.id}`}>
                <Card className="flex flex-col gap-4 p-4">
                  <CabecalhoItem resumo={item.resumo} />
                  {item.falhaDetalhe ? (
                    <p className="text-sm text-red-700">Não foi possível carregar os dados do pagamento.</p>
                  ) : (
                    <PainelPagador
                      pagamento={item.detalhe?.pagamento}
                      status={item.resumo.status}
                      podePagar={false}
                    />
                  )}
                </Card>
              </div>
            ),
          )
        )}
      </div>
    </div>
  )
}
