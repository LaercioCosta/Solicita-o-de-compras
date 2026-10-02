import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Coluna } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Select'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatarDataHora } from '../../lib/format'
import { ROTULOS_STATUS, TODOS_STATUS, ehStatusValido } from '../../lib/status'
import type { SolicitacaoResumo } from '../../types/api'

const LIMITE = 10

const colunas: Coluna<SolicitacaoResumo>[] = [
  {
    titulo: 'ID',
    renderizar: (item) => (
      <Link to={`/solicitacoes/${item.id}`} className="font-medium text-blue-600 hover:underline">
        {item.id}
      </Link>
    ),
  },
  {
    titulo: 'Descrição',
    renderizar: (item) => (
      <Link to={`/solicitacoes/${item.id}`} className="block max-w-64 truncate hover:underline">
        {item.descricao}
      </Link>
    ),
  },
  {
    titulo: 'Status',
    renderizar: (item) => <StatusBadge status={item.status} />,
  },
  {
    titulo: 'Orçamentos',
    renderizar: (item) => item._count.orcamentos,
  },
  {
    titulo: 'Atualizado em',
    renderizar: (item) => formatarDataHora(item.updatedAt),
  },
]

interface EstadoLista {
  chave: string
  itens: SolicitacaoResumo[] | null
  erro: boolean
}

export default function SolicitacoesListPage() {
  const [params, setParams] = useSearchParams()
  const statusAtual = params.get('status') ?? ''
  const statusValido = statusAtual !== '' && ehStatusValido(statusAtual)
  const statusChave = statusValido ? statusAtual : ''
  const [paginacao, setPaginacao] = useState<{ status: string; numero: number }>({ status: '', numero: 0 })
  const pagina = paginacao.status === statusChave ? paginacao.numero : 0
  const chaveAtual = `${statusChave}|${pagina}`
  const [estado, setEstado] = useState<EstadoLista>({ chave: '', itens: null, erro: false })

  useEffect(() => {
    let ativo = true
    const query = new URLSearchParams({ limit: String(LIMITE), offset: String(pagina * LIMITE) })
    if (statusChave) {
      query.set('status', statusChave)
    }
    api<SolicitacaoResumo[]>(`/solicitacoes?${query.toString()}`)
      .then((lista) => {
        if (ativo) setEstado({ chave: `${statusChave}|${pagina}`, itens: lista, erro: false })
      })
      .catch(() => {
        if (ativo) setEstado({ chave: `${statusChave}|${pagina}`, itens: null, erro: true })
      })
    return () => {
      ativo = false
    }
  }, [statusChave, pagina])

  const desatualizado = estado.chave !== chaveAtual
  const carregando = desatualizado || estado.itens === null
  const itens = !carregando && estado.itens ? estado.itens : []
  const erro = !desatualizado && estado.erro

  function aoTrocarStatus(novoStatus: string) {
    setParams((atuais) => {
      const novos = new URLSearchParams(atuais)
      if (novoStatus === '') {
        novos.delete('status')
      } else {
        novos.set('status', novoStatus)
      }
      return novos
    })
  }

  function irParaPagina(numero: number) {
    setPaginacao({ status: statusChave, numero })
  }

  return (
    <div>
      <PageHeader
        titulo="Solicitações"
        descricao="Acompanhe o fluxo de compras conforme o seu perfil."
        acoes={
          <Select
            label="Filtrar por status"
            id="filtro-status"
            value={statusChave}
            onChange={(evento) => aoTrocarStatus(evento.target.value)}
            className="w-56"
          >
            <option value="">Todos os status</option>
            {TODOS_STATUS.map((status) => (
              <option key={status} value={status}>
                {ROTULOS_STATUS[status]}
              </option>
            ))}
          </Select>
        }
      />
      <Card className="mt-6">
        {erro ? (
          <p className="px-4 py-3 text-sm text-red-700">Não foi possível carregar as solicitações.</p>
        ) : (
          <>
            <DataTable
              colunas={colunas}
              itens={itens}
              chave={(item) => item.id}
              carregando={carregando}
              vazio={
                <EmptyState
                  titulo="Nenhuma solicitação encontrada"
                  descricao="Não há solicitações para os filtros atuais."
                />
              }
            />
            {!carregando ? (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <Button variante="secundario" disabled={pagina === 0} onClick={() => irParaPagina(pagina - 1)}>
                  Anterior
                </Button>
                <p className="text-sm text-slate-500">Página {pagina + 1}</p>
                <Button variante="secundario" disabled={itens.length < LIMITE} onClick={() => irParaPagina(pagina + 1)}>
                  Próxima
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  )
}
