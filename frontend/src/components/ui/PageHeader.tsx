import type { ReactNode } from 'react'

interface PropsPageHeader {
  titulo: string
  descricao?: string
  acoes?: ReactNode
}

export function PageHeader({ titulo, descricao, acoes }: PropsPageHeader) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-slate-500">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex items-center gap-2">{acoes}</div> : null}
    </div>
  )
}
