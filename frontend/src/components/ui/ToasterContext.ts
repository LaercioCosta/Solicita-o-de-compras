import { createContext, useContext } from 'react'

export type TipoToast = 'sucesso' | 'erro'

export interface Toast {
  id: number
  tipo: TipoToast
  mensagem: string
}

export interface ValorToaster {
  mostrar: (tipo: TipoToast, mensagem: string) => void
  sucesso: (mensagem: string) => void
  erro: (mensagem: string) => void
}

export const ToasterContext = createContext<ValorToaster | null>(null)

export function useToaster(): ValorToaster {
  const contexto = useContext(ToasterContext)
  if (!contexto) {
    throw new Error('useToaster deve ser usado dentro de ToasterProvider')
  }
  return contexto
}
