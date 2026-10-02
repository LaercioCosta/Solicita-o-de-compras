import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { SkeletonLinhas } from './Skeleton'

export interface Coluna<T> {
  titulo: string
  renderizar: (item: T) => ReactNode
}

interface PropsDataTable<T> {
  colunas: Coluna<T>[]
  itens: T[]
  chave: (item: T) => string
  carregando?: boolean
  vazio?: ReactNode
}

export function DataTable<T>({ colunas, itens, chave, carregando = false, vazio }: PropsDataTable<T>) {
  if (carregando) {
    return (
      <div className="px-4 py-3">
        <SkeletonLinhas linhas={5} colunas={colunas.length} />
      </div>
    )
  }

  if (itens.length === 0) {
    return <div className="py-2">{vazio ?? <EmptyState titulo="Nenhum registro encontrado" />}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left">
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.titulo}
                scope="col"
                className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
              >
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {itens.map((item) => (
            <tr key={chave(item)} className="transition hover:bg-slate-50">
              {colunas.map((coluna) => (
                <td key={coluna.titulo} className="px-4 py-3 text-sm text-slate-700">
                  {coluna.renderizar(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
