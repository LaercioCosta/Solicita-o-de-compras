import type { InputHTMLAttributes } from 'react'

interface PropsInput extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  erro?: string
}

export function Input({ label, erro, id, className = '', ...props }: PropsInput) {
  const identificador = id ?? props.name
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={identificador} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={identificador}
        aria-invalid={erro ? true : undefined}
        className={`rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 disabled:bg-slate-100 ${
          erro ? 'border-red-500' : 'border-slate-300'
        } ${className}`}
        {...props}
      />
      {erro ? <span className="text-xs text-red-600">{erro}</span> : null}
    </div>
  )
}
