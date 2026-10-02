import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useContagemNotificacoes } from '../../layouts/NotificacoesContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { SkeletonLinhas } from '../../components/ui/Skeleton'
import { useToaster } from '../../components/ui/ToasterContext'
import { formatarDataHora } from '../../lib/format'
import type { Notificacao } from '../../types/api'

export default function NotificacoesPage() {
  const { atualizar } = useContagemNotificacoes()
  const toaster = useToaster()
  const [notificacoes, setNotificacoes] = useState<Notificacao[] | null>(null)
  const [erro, setErro] = useState('')
  const [marcando, setMarcando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    api<Notificacao[]>('/notificacoes')
      .then((lista) => setNotificacoes(lista))
      .catch(() => setErro('Não foi possível carregar as notificações.'))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function marcarLida(id: string) {
    setMarcando(id)
    try {
      const atualizada = await api<Notificacao>(`/notificacoes/${id}/lida`, { method: 'POST' })
      setNotificacoes((atuais) =>
        atuais ? atuais.map((notificacao) => (notificacao.id === id ? atualizada : notificacao)) : atuais,
      )
      atualizar()
    } catch {
      toaster.erro('Não foi possível marcar a notificação como lida.')
    } finally {
      setMarcando(null)
    }
  }

  return (
    <div>
      <PageHeader titulo="Notificações" descricao="Avisos do fluxo de compras." />
      <Card className="mt-6">
        {erro ? (
          <p className="px-4 py-3 text-sm text-red-700">{erro}</p>
        ) : notificacoes === null ? (
          <div className="px-4 py-3">
            <SkeletonLinhas linhas={3} colunas={2} />
          </div>
        ) : notificacoes.length === 0 ? (
          <EmptyState titulo="Nenhuma notificação" descricao="Você não possui notificações no momento." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notificacoes.map((notificacao) => (
              <li key={notificacao.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tom={notificacao.lida ? 'cinza' : 'azul'}>
                      {notificacao.lida ? 'Lida' : 'Não lida'}
                    </Badge>
                    <p className="text-sm text-slate-500">{formatarDataHora(notificacao.createdAt)}</p>
                  </div>
                  <p className="text-sm break-words text-slate-800">{notificacao.mensagem}</p>
                  <Link
                    to={`/solicitacoes/${notificacao.solicitacaoId}`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ver solicitação {notificacao.solicitacaoId}
                  </Link>
                </div>
                {!notificacao.lida ? (
                  <Button
                    variante="secundario"
                    disabled={marcando === notificacao.id}
                    onClick={() => marcarLida(notificacao.id)}
                  >
                    {marcando === notificacao.id ? 'Marcando...' : 'Marcar como lida'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
