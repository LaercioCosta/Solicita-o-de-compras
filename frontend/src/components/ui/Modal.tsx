import { useEffect, type ReactNode } from 'react'

interface PropsModal {
  aberto: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
  acoes?: ReactNode
}

export function Modal({ aberto, titulo, aoFechar, children, acoes }: PropsModal) {
  useEffect(() => {
    if (!aberto) return
    const aoPressionarEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoPressionarEsc)
    return () => window.removeEventListener('keydown', aoPressionarEsc)
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={aoFechar}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={aoFechar}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="mt-4 text-sm text-slate-600">{children}</div>
        {acoes ? <div className="mt-6 flex justify-end gap-2">{acoes}</div> : null}
      </div>
    </div>
  )
}
