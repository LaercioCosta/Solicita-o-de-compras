import type { ReactNode } from 'react'

export type TomBadge = 'neutro' | 'azul' | 'verde' | 'vermelho' | 'cinza' | 'ambar'

const TONS: Record<TomBadge, string> = {
  neutro: 'bg-slate-100 text-slate-700 ring-slate-200',
  azul: 'bg-blue-50 text-blue-700 ring-blue-200',
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  vermelho: 'bg-red-50 text-red-700 ring-red-200',
  cinza: 'bg-slate-200 text-slate-600 ring-slate-300',
  ambar: 'bg-amber-50 text-amber-700 ring-amber-200',
}

interface PropsBadge {
  children: ReactNode
  tom?: TomBadge
}

export function Badge({ children, tom = 'neutro' }: PropsBadge) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONS[tom]}`}
    >
      {children}
    </span>
  )
}
