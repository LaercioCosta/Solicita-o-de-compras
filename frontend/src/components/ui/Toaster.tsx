import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToasterContext, type Toast, type TipoToast, type ValorToaster } from './ToasterContext'

let proximoId = 1

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remover = useCallback((id: number) => {
    setToasts((atuais) => atuais.filter((toast) => toast.id !== id))
  }, [])

  const mostrar = useCallback((tipo: TipoToast, mensagem: string) => {
    const id = proximoId
    proximoId += 1
    setToasts((atuais) => [...atuais, { id, tipo, mensagem }])
    window.setTimeout(() => {
      setToasts((atuais) => atuais.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  const valor = useMemo<ValorToaster>(
    () => ({
      mostrar,
      sucesso: (mensagem: string) => mostrar('sucesso', mensagem),
      erro: (mensagem: string) => mostrar('erro', mensagem),
    }),
    [mostrar],
  )

  return (
    <ToasterContext.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            onClick={() => remover(toast.id)}
            className={`pointer-events-auto rounded-md px-4 py-3 text-left text-sm shadow-lg ring-1 ${
              toast.tipo === 'sucesso'
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                : 'bg-red-50 text-red-800 ring-red-200'
            }`}
          >
            {toast.mensagem}
          </button>
        ))}
      </div>
    </ToasterContext.Provider>
  )
}
