import type { ButtonHTMLAttributes } from 'react'

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma'

const VARIACOES: Record<VarianteBotao, string> = {
  primario: 'bg-blue-600 text-white hover:bg-blue-700',
  secundario: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'text-slate-600 hover:bg-slate-100',
}

interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
}

export function Button({ variante = 'primario', className = '', ...props }: PropsBotao) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50'
  return <button type="button" className={`${base} ${VARIACOES[variante]} ${className}`} {...props} />
}
