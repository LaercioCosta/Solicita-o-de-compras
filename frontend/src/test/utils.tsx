import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CHAVE_SESSAO } from '../api/client'
import { AuthProvider } from '../auth/AuthProvider'
import { ToasterProvider } from '../components/ui/Toaster'
import { AppRoutes } from '../router'
import type { Perfil, Sessao } from '../types/api'
import { EMAILS, USUARIOS_POR_EMAIL } from './handlers'

interface TokensSessao {
  accessToken: string
  refreshToken: string
}

const TOKENS_PADRAO: TokensSessao = { accessToken: 'access-token-1', refreshToken: 'refresh-token-1' }

export function semearSessao(perfil: Perfil, tokens: TokensSessao = TOKENS_PADRAO): void {
  const email = EMAILS[perfil]
  const sessao: Sessao = { ...tokens, usuario: USUARIOS_POR_EMAIL[email] }
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
}

export function renderizarApp(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <AuthProvider>
        <ToasterProvider>
          <AppRoutes />
        </ToasterProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}
