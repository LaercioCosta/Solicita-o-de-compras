import type { ReactNode } from 'react'

interface PropsCard {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: PropsCard) {
  return (
    <div className={`rounded-lg bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>
  )
}

interface PropsTituloCard {
  children: ReactNode
}

export function CardTitulo({ children }: PropsTituloCard) {
  return <h3 className="text-sm font-semibold text-slate-900">{children}</h3>
}
