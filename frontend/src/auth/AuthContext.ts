import { createContext, useContext } from 'react'
import type { Usuario } from '../types/api'

export interface ValorAuth {
  usuario: Usuario | null
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<ValorAuth | null>(null)

export function useAuth(): ValorAuth {
  const contexto = useContext(AuthContext)
  if (!contexto) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return contexto
}
