import type { SelectHTMLAttributes } from 'react'

interface PropsSelect extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  erro?: string
}

export function Select({ label, erro, id, className = '', children, ...props }: PropsSelect) {
  const identificador = id ?? props.name
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={identificador} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={identificador}
        aria-invalid={erro ? true : undefined}
        className={`rounded-md border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 ${
          erro ? 'border-red-500' : 'border-slate-300'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {erro ? <span className="text-xs text-red-600">{erro}</span> : null}
    </div>
  )
}
