import { createContext, useContext } from 'react'

export interface ValorNotificacoes {
  naoLidas: number
  atualizar: () => void
}

export const NotificacoesContext = createContext<ValorNotificacoes>({
  naoLidas: 0,
  atualizar: () => {},
})

export function useContagemNotificacoes(): ValorNotificacoes {
  return useContext(NotificacoesContext)
}
