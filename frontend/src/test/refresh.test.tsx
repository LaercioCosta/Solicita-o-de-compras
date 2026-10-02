import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { CHAVE_SESSAO } from '../api/client'
import { renderizarApp, semearSessao } from './utils'
import { server } from './server'

describe('renovação de sessão em 401', () => {
  it('dispara um único refresh para chamadas concorrentes e refaz a requisição', async () => {
    let chamadasRefresh = 0
    server.use(
      http.post('/api/auth/refresh', async ({ request }) => {
        chamadasRefresh += 1
        const corpo = (await request.json()) as { refreshToken?: string }
        if (corpo.refreshToken !== 'refresh-token-1') {
          return HttpResponse.json({ message: 'Refresh token inválido.', statusCode: 401 }, { status: 401 })
        }
        return HttpResponse.json({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' })
      }),
    )

    semearSessao('GERENTE', { accessToken: 'token-antigo', refreshToken: 'refresh-token-1' })
    renderizarApp('/')

    expect(await screen.findByText('Pendências de aprovação')).toBeInTheDocument()

    const sessao = JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? '{}') as {
      accessToken: string
      refreshToken: string
    }
    expect(sessao.accessToken).toBe('access-token-2')
    expect(sessao.refreshToken).toBe('refresh-token-2')
    expect(chamadasRefresh).toBe(1)
  })

  it('limpa a sessão e volta ao login quando o refresh falha', async () => {
    semearSessao('GERENTE', { accessToken: 'token-antigo', refreshToken: 'refresh-revogado' })
    renderizarApp('/')

    await waitFor(() =>
      expect(screen.getByText('Entre com suas credenciais para acessar')).toBeInTheDocument(),
    )
    expect(localStorage.getItem(CHAVE_SESSAO)).toBeNull()
  })
})
