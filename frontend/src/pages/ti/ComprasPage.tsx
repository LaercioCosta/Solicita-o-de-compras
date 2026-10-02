import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Coluna } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatarDataHora } from '../../lib/format'
import type { EstadoSolicitacao, SolicitacaoResumo } from '../../types/api'
import { PainelTi } from './components/PainelTi'

interface FilaCompras {
  status: EstadoSolicitacao
  titulo: string
  descricao: string
  vazio: string
}

const FILAS: FilaCompras[] = [
  {
    status: 'APROVADO',
    titulo: 'Aprovadas para comprar',
    descricao: 'Solicitações com orçamento definido pela aprovação financeira, prontas para a compra.',
    vazio: 'Nenhuma solicitação aprovada para comprar',
  },
  {
    status: 'COMPRA_EM_ANDAMENTO',
    titulo: 'Em andamento',
    descricao: 'Compras executadas que aguardam os dados de pagamento para o Financeiro.',
    vazio: 'Nenhuma compra em andamento',
  },
  {
    status: 'PAGO',
    titulo: 'Aguardando NF',
    descricao: 'Solicitações pagas que aguardam o anexo da nota fiscal.',
    vazio: 'Nenhuma solicitação aguardando nota fiscal',
  },
]

function FilaComprasTi({
  fila,
  versao,
  aoAcaoConcluida,
}: {
  fila: FilaCompras
  versao: number
  aoAcaoConcluida: () => void
}) {
  const [estado, setEstado] = useState<{ itens: SolicitacaoResumo[] | null; erro: boolean }>({
    itens: null,
    erro: false,
  })

  const carregar = useCallback(() => {
    api<SolicitacaoResumo[]>(`/solicitacoes?status=${fila.status}`)
      .then((lista) => setEstado({ itens: lista, erro: false }))
      .catch(() => setEstado({ itens: null, erro: true }))
  }, [fila.status])

  useEffect(() => {
    carregar()
  }, [carregar, versao])

  const itens = estado.itens ?? []
  const erro = estado.erro

  const colunas: Coluna<SolicitacaoResumo>[] = [
    {
      titulo: 'ID',
      renderizar: (item) => (
        <Link
          to={`/solicitacoes/${item.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {item.id}
        </Link>
      ),
    },
    {
      titulo: 'Descrição',
      renderizar: (item) => (
        <Link to={`/solicitacoes/${item.id}`} className="block max-w-72 truncate hover:underline">
          {item.descricao}
        </Link>
      ),
    },
    {
      titulo: 'Orçamentos',
      renderizar: (item) => item._count.orcamentos,
    },
    {
      titulo: 'Atualizado em',
      renderizar: (item) => formatarDataHora(item.updatedAt),
    },
    {
      titulo: 'Ações',
      renderizar: (item) => <PainelTi solicitacao={item} aoAcaoConcluida={aoAcaoConcluida} />,
    },
  ]

  return (
    <section data-testid={`fila-${fila.status}`} aria-labelledby={`titulo-fila-${fila.status}`}>
      <Card>
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 id={`titulo-fila-${fila.status}`} className="text-sm font-semibold text-slate-900">
              {fila.titulo}
            </h2>
            <p className="text-xs text-slate-500">{fila.descricao}</p>
          </div>
          {estado.itens && !erro ? <Badge tom="azul">{estado.itens.length}</Badge> : null}
        </div>
        {erro ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <p className="text-sm text-red-700">Não foi possível carregar a fila.</p>
            <Button variante="secundario" onClick={carregar}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <DataTable
            colunas={colunas}
            itens={itens}
            chave={(item) => item.id}
            carregando={estado.itens === null}
            vazio={<EmptyState titulo={fila.vazio} />}
          />
        )}
      </Card>
    </section>
  )
}

export default function ComprasPage() {
  const [versao, setVersao] = useState(0)
  const aoAcaoConcluida = useCallback(() => {
    setVersao((atual) => atual + 1)
  }, [])

  return (
    <div>
      <PageHeader
        titulo="Compras"
        descricao="Execute compras aprovadas, registre os dados de pagamento e anexe as notas fiscais."
      />
      <div className="mt-6 flex flex-col gap-6">
        {FILAS.map((fila) => (
          <FilaComprasTi
            key={fila.status}
            fila={fila}
            versao={versao}
            aoAcaoConcluida={aoAcaoConcluida}
          />
        ))}
      </div>
    </div>
  )
}
