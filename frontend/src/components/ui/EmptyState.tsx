import type { ReactNode } from 'react'

interface PropsEmptyState {
  titulo: string
  descricao?: string
  acao?: ReactNode
}

export function EmptyState({ titulo, descricao, acao }: PropsEmptyState) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-10 text-slate-300">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m-4.5-6.75l.375 6.75m8.625-6.75l-.375 6.75M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
        />
      </svg>
      <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      {descricao ? <p className="max-w-sm text-sm text-slate-500">{descricao}</p> : null}
      {acao ? <div className="mt-2">{acao}</div> : null}
    </div>
  )
}
