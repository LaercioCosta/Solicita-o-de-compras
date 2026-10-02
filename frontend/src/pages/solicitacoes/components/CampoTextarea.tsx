import type { ChangeEvent } from 'react'

interface PropsCampoTextarea {
  id: string
  label: string
  valor: string
  aoAlterar: (evento: ChangeEvent<HTMLTextAreaElement>) => void
  erro?: string
  limite?: number
  linhas?: number
}

export function CampoTextarea({
  id,
  label,
  valor,
  aoAlterar,
  erro,
  limite,
  linhas = 4,
}: PropsCampoTextarea) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        value={valor}
        onChange={aoAlterar}
        rows={linhas}
        maxLength={limite}
        aria-invalid={erro ? true : undefined}
        className={`rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 ${
          erro ? 'border-red-500' : 'border-slate-300'
        }`}
      />
      {erro ? <span className="text-xs text-red-600">{erro}</span> : null}
    </div>
  )
}
