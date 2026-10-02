import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { File as FileNode } from 'node:buffer'
import { FormData as FormDataNode } from 'undici'
import { semearSessao, renderizarApp } from '../../test/utils'
import { autorizado, respostaNaoAutorizada } from '../../test/handlers'
import { server } from '../../test/server'
import { criarHandlersPagamentos, DADOS_BOLETO, DADOS_PIX } from './msw'

const escreverAreaTransferencia = vi.fn(async () => undefined)

beforeAll(() => {
  vi.stubGlobal('FormData', FormDataNode)
  vi.stubGlobal('File', FileNode)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

function instalarMockClipboard() {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: escreverAreaTransferencia },
    configurable: true,
    writable: true,
  })
}

function criarUsuario(opcoes: Parameters<typeof userEvent.setup>[0] = {}) {
  const usuario = userEvent.setup(opcoes)
  instalarMockClipboard()
  return usuario
}

beforeEach(() => {
  instalarMockClipboard()
  escreverAreaTransferencia.mockClear()
})

async function abrirModalDePagar(idItem: string, usuario = criarUsuario()) {
  const cartao = await screen.findByTestId(idItem)
  await usuario.click(within(cartao).getByRole('button', { name: 'Registrar pagamento' }))
  return { usuario, cartao, dialogo: within(screen.getByRole('dialog')) }
}

describe('fila de pagamentos', () => {
  it('renderiza a fila com os dados do boleto e copia o código', async () => {
    const usuario = criarUsuario()
    semearSessao('FINANCEIRO')
    server.use(...criarHandlersPagamentos().handlers)
    renderizarApp('/pagamentos')

    expect(await screen.findByText('Notebook para o setor financeiro')).toBeInTheDocument()
    expect(screen.getByText('Boleto')).toBeInTheDocument()
    expect(screen.getByText(DADOS_BOLETO)).toBeInTheDocument()
    expect(screen.getByText('3 aguardando pagamento')).toBeInTheDocument()

    const bloco = screen.getByText(DADOS_BOLETO).closest('div') as HTMLElement
    await usuario.click(within(bloco).getByRole('button', { name: 'Copiar' }))

    await waitFor(() => expect(escreverAreaTransferencia).toHaveBeenCalledWith(DADOS_BOLETO))
    expect(await within(bloco).findByRole('button', { name: 'Copiado' })).toBeInTheDocument()
  })

  it('renderiza pagamento via PIX e copia a chave', async () => {
    const usuario = criarUsuario()
    semearSessao('FINANCEIRO')
    server.use(...criarHandlersPagamentos().handlers)
    renderizarApp('/pagamentos')

    expect(await screen.findByText('Licença de software contábil')).toBeInTheDocument()
    expect(screen.getByText('PIX')).toBeInTheDocument()
    expect(screen.getByText(DADOS_PIX)).toBeInTheDocument()

    const bloco = screen.getByText(DADOS_PIX).closest('div') as HTMLElement
    await usuario.click(within(bloco).getByRole('button', { name: 'Copiar' }))

    await waitFor(() => expect(escreverAreaTransferencia).toHaveBeenCalledWith(DADOS_PIX))
    expect(await within(bloco).findByRole('button', { name: 'Copiado' })).toBeInTheDocument()
  })

  it('informa quando a cópia falha sem quebrar a página', async () => {
    escreverAreaTransferencia.mockRejectedValueOnce(new Error('sem contexto seguro'))
    const usuario = criarUsuario()
    semearSessao('FINANCEIRO')
    server.use(...criarHandlersPagamentos().handlers)
    renderizarApp('/pagamentos')

    const cartao = await screen.findByTestId('item-fila-sol-boleto')
    await usuario.click(within(cartao).getByRole('button', { name: 'Copiar' }))

    expect(await screen.findByText('Não foi possível copiar.')).toBeInTheDocument()
  })

  it('trata detalhe sem pagamento com mensagem e sem quebrar a página', async () => {
    semearSessao('FINANCEIRO')
    server.use(...criarHandlersPagamentos().handlers)
    renderizarApp('/pagamentos')

    const cartao = await screen.findByTestId('item-fila-sol-sem-pagamento')
    expect(within(cartao).getByText('Pagamento não disponível')).toBeInTheDocument()
    expect(within(cartao).queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument()
    expect(screen.getByTestId('item-fila-sol-boleto')).toBeInTheDocument()
    expect(screen.getByTestId('item-fila-sol-pix')).toBeInTheDocument()
  })

  it('exibe estado vazio quando não há pagamentos pendentes', async () => {
    semearSessao('FINANCEIRO')
    server.use(
      http.get('/api/solicitacoes', ({ request }) => {
        if (!autorizado(request)) {
          return respostaNaoAutorizada()
        }
        return HttpResponse.json([])
      }),
    )
    renderizarApp('/pagamentos')

    expect(await screen.findByText('Nenhum pagamento pendente')).toBeInTheDocument()
    expect(screen.getByText('0 aguardando pagamento')).toBeInTheDocument()
  })
})

describe('registro de pagamento', () => {
  it('envia FormData com valorPago e comprovante, mostra toast e remove da fila', async () => {
    const { handlers, recebidos } = criarHandlersPagamentos()
    server.use(...handlers)
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/pagamentos')

    const { usuario, dialogo } = await abrirModalDePagar('item-fila-sol-boleto')
    await usuario.type(dialogo.getByLabelText('Valor pago (R$)'), '1250.50')
    await usuario.upload(
      dialogo.getByLabelText('Comprovante'),
      new File(['conteudo'], 'comprovante.pdf', { type: 'application/pdf' }),
    )
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar pagamento' }))

    expect(await screen.findByText('Pagamento registrado')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('item-fila-sol-boleto')).not.toBeInTheDocument())
    expect(screen.getByTestId('item-fila-sol-pix')).toBeInTheDocument()
    expect(recebidos).toHaveLength(1)
    expect(recebidos[0].url).toContain('/api/pagamentos/pg-boleto/pagar')
    expect(recebidos[0].valorPago).toBe('1250.50')
    expect(recebidos[0].nomeArquivo).toBe('comprovante.pdf')
  })

  it('bloqueia valor inválido no cliente sem chamar a API', async () => {
    const { handlers, recebidos } = criarHandlersPagamentos()
    server.use(...handlers)
    semearSessao('FINANCEIRO')
    renderizarApp('/pagamentos')

    const { usuario, dialogo } = await abrirModalDePagar('item-fila-sol-boleto')
    await usuario.type(dialogo.getByLabelText('Valor pago (R$)'), 'abc')
    await usuario.upload(
      dialogo.getByLabelText('Comprovante'),
      new File(['conteudo'], 'comprovante.pdf', { type: 'application/pdf' }),
    )
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar pagamento' }))

    expect(
      await dialogo.findByText('Valor inválido. Use até 2 casas decimais (ex.: 1500.00).'),
    ).toBeInTheDocument()
    expect(recebidos).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('bloqueia comprovante em formato não aceito no cliente sem chamar a API', async () => {
    const { handlers, recebidos } = criarHandlersPagamentos()
    server.use(...handlers)
    semearSessao('FINANCEIRO')
    renderizarApp('/pagamentos')

    const { usuario, dialogo } = await abrirModalDePagar('item-fila-sol-boleto', criarUsuario({ applyAccept: false }))
    await usuario.type(dialogo.getByLabelText('Valor pago (R$)'), '100.00')
    await usuario.upload(
      dialogo.getByLabelText('Comprovante'),
      new File(['binario'], 'comprovante.exe', { type: 'application/octet-stream' }),
    )
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar pagamento' }))

    expect(await dialogo.findByText('Formato inválido. Envie PDF, PNG, JPG ou JPEG.')).toBeInTheDocument()
    expect(recebidos).toHaveLength(0)
    expect(screen.getByTestId('item-fila-sol-boleto')).toBeInTheDocument()
  })

  it('exibe toast de pagamento já executado no conflito 409', async () => {
    const { handlers } = criarHandlersPagamentos({ statusResposta: 409, mensagemErro: 'Pagamento já executado.' })
    server.use(...handlers)
    semearSessao('FINANCEIRO')
    renderizarApp('/pagamentos')

    const { usuario, dialogo } = await abrirModalDePagar('item-fila-sol-boleto')
    await usuario.type(dialogo.getByLabelText('Valor pago (R$)'), '1250.50')
    await usuario.upload(
      dialogo.getByLabelText('Comprovante'),
      new File(['conteudo'], 'comprovante.pdf', { type: 'application/pdf' }),
    )
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar pagamento' }))

    expect(await screen.findByText('Pagamento já executado')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('item-fila-sol-boleto')).not.toBeInTheDocument())
  })

  it('exibe a mensagem do corpo do erro 400 inline no modal', async () => {
    const { handlers } = criarHandlersPagamentos({ statusResposta: 400, mensagemErro: 'Comprovante inválido.' })
    server.use(...handlers)
    semearSessao('FINANCEIRO')
    renderizarApp('/pagamentos')

    const { usuario, dialogo } = await abrirModalDePagar('item-fila-sol-boleto')
    await usuario.type(dialogo.getByLabelText('Valor pago (R$)'), '1250.50')
    await usuario.upload(
      dialogo.getByLabelText('Comprovante'),
      new File(['conteudo'], 'comprovante.pdf', { type: 'application/pdf' }),
    )
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar pagamento' }))

    expect(await screen.findByText('Comprovante inválido.')).toBeInTheDocument()
    expect(screen.getByTestId('item-fila-sol-boleto')).toBeInTheDocument()
    expect(screen.queryByText('Pagamento registrado')).not.toBeInTheDocument()
  })
})

describe('histórico de pagamentos', () => {
  it('mostra valor pago e data no histórico', async () => {
    const usuario = criarUsuario()
    semearSessao('FINANCEIRO')
    server.use(...criarHandlersPagamentos().handlers)
    renderizarApp('/pagamentos')

    await screen.findByTestId('item-fila-sol-boleto')
    await usuario.click(screen.getByRole('tab', { name: 'Histórico' }))

    const cartao = await screen.findByTestId('item-historico-sol-pago')
    expect(within(cartao).getByText('Monitor para estação de trabalho')).toBeInTheDocument()
    expect(within(cartao).getByText('Pago em 22/09/2026')).toBeInTheDocument()
    expect(within(cartao).getByText('R$ 1.250,50')).toBeInTheDocument()
  })
})
