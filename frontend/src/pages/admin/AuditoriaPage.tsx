import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { ROTULOS_PERFIL } from '../../auth/capacidades'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Coluna } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatarDataHora } from '../../lib/format'
import { ehStatusValido, ROTULOS_STATUS, TODOS_STATUS } from '../../lib/status'
import {
  ACOES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  ROTULOS_ACAO,
  ROTULOS_ENTIDADE,
  TONS_ACAO,
  type RegistroAuditoria,
} from './tipos'

interface FiltrosAuditoria {
  entidade: string
  entidadeId: string
  usuarioId: string
  acao: string
  estadoNovo: string
  limit: string
}

const FILTROS_INICIAIS: FiltrosAuditoria = {
  entidade: '',
  entidadeId: '',
  usuarioId: '',
  acao: '',
  estadoNovo: '',
  limit: '20',
}

function rotuloEstado(estado: string | null): string {
  if (!estado) return '—'
  return ehStatusValido(estado) ? ROTULOS_STATUS[estado] : estado
}

function montarConsulta(filtros: FiltrosAuditoria, offset: number): string {
  const parametros = new URLSearchParams()
  if (filtros.entidade) parametros.set('entidade', filtros.entidade)
  const entidadeId = Number.parseInt(filtros.entidadeId, 10)
  if (Number.isInteger(entidadeId) && entidadeId > 0) parametros.set('entidadeId', String(entidadeId))
  const usuarioId = Number.parseInt(filtros.usuarioId, 10)
  if (Number.isInteger(usuarioId) && usuarioId > 0) parametros.set('usuarioId', String(usuarioId))
  if (filtros.acao) parametros.set('acao', filtros.acao)
  if (filtros.estadoNovo) parametros.set('estadoNovo', filtros.estadoNovo)
  parametros.set('limit', filtros.limit)
  parametros.set('offset', String(offset))
  return parametros.toString()
}

export default function AuditoriaPage() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_INICIAIS)
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>(FILTROS_INICIAIS)
  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null)
  const [erro, setErro] = useState('')
  const [offset, setOffset] = useState(0)

  const consultar = useCallback((filtrosConsulta: FiltrosAuditoria, offsetConsulta: number) => {
    api<RegistroAuditoria[]>(`/auditoria?${montarConsulta(filtrosConsulta, offsetConsulta)}`)
      .then((lista) => setRegistros(lista))
      .catch(() => setErro('Não foi possível carregar os registros de auditoria.'))
  }, [])

  useEffect(() => {
    consultar(FILTROS_INICIAIS, 0)
  }, [consultar])

  function recarregar(filtrosConsulta: FiltrosAuditoria, offsetConsulta: number) {
    setRegistros(null)
    setErro('')
    consultar(filtrosConsulta, offsetConsulta)
  }

  function aplicarFiltros(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setAplicados(filtros)
    setOffset(0)
    recarregar(filtros, 0)
  }

  const limit = Number.parseInt(aplicados.limit, 10)
  const paginaAtual = Math.floor(offset / limit) + 1

  function alterarCampo(campo: keyof FiltrosAuditoria, valor: string) {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }))
  }

  const colunas: Coluna<RegistroAuditoria>[] = [
    { titulo: 'Quando', renderizar: (registro) => formatarDataHora(registro.createdAt) },
    {
      titulo: 'Usuário',
      renderizar: (registro) => (
        <div className="flex flex-col">
          <span className="font-medium">{registro.usuario.nome}</span>
          <span className="text-xs text-slate-500">{registro.usuario.email}</span>
        </div>
      ),
    },
    {
      titulo: 'Perfil',
      renderizar: (registro) => <Badge tom="neutro">{ROTULOS_PERFIL[registro.perfil]}</Badge>,
    },
    {
      titulo: 'Ação',
      renderizar: (registro) => (
        <Badge tom={TONS_ACAO[registro.acao]}>{ROTULOS_ACAO[registro.acao]}</Badge>
      ),
    },
    {
      titulo: 'Entidade',
      renderizar: (registro) => `${ROTULOS_ENTIDADE[registro.entidade] ?? registro.entidade} #${registro.entidadeId}`,
    },
    {
      titulo: 'Transição',
      renderizar: (registro) => (
        <span className="flex items-center gap-1">
          <span>{rotuloEstado(registro.estadoAnterior)}</span>
          <span aria-hidden="true" className="text-slate-400">
            →
          </span>
          <span>{rotuloEstado(registro.estadoNovo)}</span>
        </span>
      ),
    },
    {
      titulo: 'Dados',
      renderizar: (registro) =>
        registro.dados == null ? (
          '—'
        ) : (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-blue-600">Ver dados</summary>
            <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
              {JSON.stringify(registro.dados, null, 2)}
            </pre>
          </details>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo="Auditoria"
        descricao="Registros de ações críticas do sistema (somente leitura)."
      />
      <Card className="mt-6">
        <form onSubmit={aplicarFiltros} className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label htmlFor="filtro-entidade" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Entidade
            <select
              id="filtro-entidade"
              name="entidade"
              value={filtros.entidade}
              onChange={(evento) => alterarCampo('entidade', evento.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-2 focus:outline-blue-600"
            >
              <option value="">Todas</option>
              {ENTIDADES_AUDITORIA.map((entidade) => (
                <option key={entidade} value={entidade}>
                  {ROTULOS_ENTIDADE[entidade]}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="ID da entidade"
            name="entidadeId"
            type="number"
            min={1}
            value={filtros.entidadeId}
            onChange={(evento) => alterarCampo('entidadeId', evento.target.value)}
          />
          <Input
            label="ID do usuário"
            name="usuarioId"
            type="number"
            min={1}
            value={filtros.usuarioId}
            onChange={(evento) => alterarCampo('usuarioId', evento.target.value)}
          />
          <label htmlFor="filtro-acao" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ação
            <select
              id="filtro-acao"
              name="acao"
              value={filtros.acao}
              onChange={(evento) => alterarCampo('acao', evento.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-2 focus:outline-blue-600"
            >
              <option value="">Todas</option>
              {ACOES_AUDITORIA.map((acao) => (
                <option key={acao} value={acao}>
                  {ROTULOS_ACAO[acao]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="filtro-estado" className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Novo estado
            <select
              id="filtro-estado"
              name="estadoNovo"
              value={filtros.estadoNovo}
              onChange={(evento) => alterarCampo('estadoNovo', evento.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-2 focus:outline-blue-600"
            >
              <option value="">Todos</option>
              {TODOS_STATUS.map((estado) => (
                <option key={estado} value={estado}>
                  {ROTULOS_STATUS[estado]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label htmlFor="filtro-limit" className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
              Registros por página
              <select
                id="filtro-limit"
                name="limit"
                value={filtros.limit}
                onChange={(evento) => alterarCampo('limit', evento.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:outline-2 focus:outline-blue-600"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-6">
            <Button type="submit">Filtrar</Button>
          </div>
        </form>
        {erro ? (
          <p className="px-4 py-3 text-sm text-red-700">{erro}</p>
        ) : (
          <DataTable
            colunas={colunas}
            itens={registros ?? []}
            chave={(registro) => String(registro.id)}
            carregando={registros === null}
            vazio={
              <EmptyState
                titulo="Nenhum registro de auditoria"
                descricao="Nenhuma ação encontrada com os filtros atuais."
              />
            }
          />
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-500">Página {paginaAtual}</span>
          <div className="flex gap-2">
            <Button
              variante="secundario"
              disabled={offset === 0 || registros === null}
              onClick={() => {
                const novoOffset = Math.max(0, offset - limit)
                setOffset(novoOffset)
                recarregar(aplicados, novoOffset)
              }}
            >
              Anterior
            </Button>
            <Button
              variante="secundario"
              disabled={registros === null || registros.length < limit}
              onClick={() => {
                const novoOffset = offset + limit
                setOffset(novoOffset)
                recarregar(aplicados, novoOffset)
              }}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
