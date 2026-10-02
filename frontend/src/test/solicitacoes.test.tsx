import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderizarApp, semearSessao } from './utils'
import { server } from './server'
import { autorizado, listaSolicitacoesFiltrada, respostaNaoAutorizada } from './handlers'

describe('lista de solicitações', () => {
  it('renderiza os itens da lista', async () => {
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes')

    expect(await screen.findByText('Compra de notebooks novos')).toBeInTheDocument()
    expect(screen.getByText('Licenças de software de design')).toBeInTheDocument()
    expect(screen.getByText('Monitor 27 para estação de trabalho')).toBeInTheDocument()
    expect(screen.getByText('Página 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  })

  it('filtra por status e consulta o endpoint com o parâmetro', async () => {
    const urls: string[] = []
    server.use(
      http.get('/api/solicitacoes', ({ request }) => {
        urls.push(request.url)
        if (!autorizado(request)) {
          return respostaNaoAutorizada()
        }
        return HttpResponse.json(listaSolicitacoesFiltrada(new URL(request.url)))
      }),
    )

    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes')

    await screen.findByText('Compra de notebooks novos')
    await usuario.selectOptions(screen.getByLabelText('Filtrar por status'), 'RASCUNHO')

    await waitFor(() => {
      expect(urls.length).toBeGreaterThan(0)
      expect(urls.some((url) => url.includes('status=RASCUNHO'))).toBe(true)
    })
    expect(await screen.findByText('Reposição de material de escritório')).toBeInTheDocument()
    expect(screen.queryByText('Compra de notebooks novos')).not.toBeInTheDocument()
  })
})

describe('detalhe da solicitação', () => {
  it('renderiza stepper, itens e orçamentos', async () => {
    semearSessao('SOLICITANTE')
    renderizarApp('/solicitacoes/s1')

    expect(await screen.findByText('Notebook Dell Latitude 5540')).toBeInTheDocument()
    expect(screen.getByTestId('etapa-atual')).toHaveTextContent('Compra em andamento')
    expect(screen.getByText('Ciclo 2')).toBeInTheDocument()
    expect(screen.getByText('R$ 12.345,60')).toBeInTheDocument()
    expect(screen.getByText('12.345.678/0001-99')).toBeInTheDocument()

    const linksLoja = screen.getAllByRole('link', { name: 'Abrir loja' })
    expect(linksLoja[0]).toHaveAttribute('href', 'https://loja-a.example.com/notebooks')
    expect(screen.getByText('30/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Documentos do orçamento')).toBeInTheDocument()
  })
})
