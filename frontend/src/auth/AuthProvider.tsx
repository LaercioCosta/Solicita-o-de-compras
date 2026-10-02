import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  EVENTO_SESSAO_EXPIRADA,
  entrar,
  lerSessao,
  limparSessao,
  sair,
  salvarSessao,
} from '../api/client'
import type { Sessao } from '../types/api'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState(() => lerSessao()?.usuario ?? null)

  useEffect(() => {
    const aoExpirarSessao = () => setUsuario(null)
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirarSessao)
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirarSessao)
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const sessao: Sessao = await entrar(email, senha)
    salvarSessao(sessao)
    setUsuario(sessao.usuario)
  }, [])

  const logout = useCallback(() => {
    sair()
    limparSessao()
    setUsuario(null)
  }, [])

  const valor = useMemo(() => ({ usuario, login, logout }), [usuario, login, logout])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
