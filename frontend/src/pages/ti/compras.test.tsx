import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ToasterProvider } from '../../components/ui/Toaster'
import { autorizado, respostaNaoAutorizada } from '../../test/handlers'
import { server } from '../../test/server'
import { renderizarApp, semearSessao } from '../../test/utils'
import type {
  EstadoSolicitacao,
  SolicitacaoDetalhe,
  SolicitacaoResumo,
} from '../../types/api'
import { PainelTi } from './components/PainelTi'

const FormDataJsdom = globalThis.FormData
let ArquivoNode: typeof File

beforeAll(async () => {
  const exemplo = await new Response('a=b', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }).formData()
  globalThis.FormData = exemplo.constructor as typeof FormData
  const comArquivo = await new Response(
    '--limite\r\nContent-Disposition: form-data; name="arquivo"; filename="modelo.pdf"\r\nContent-Type: application/pdf\r\n\r\nconteudo\r\n--limite--\r\n',
    { headers: { 'content-type': 'multipart/form-data; boundary=limite' } },
  ).formData()
  ArquivoNode = (comArquivo.get('arquivo') as File).constructor as typeof File
})

afterAll(() => {
  globalThis.FormData = FormDataJsdom
})

const BASE = {
  solicitanteId: 'u1',
  setorId: 'st1',
  motivoCancelamento: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-10T14:30:00.000Z',
}

function criarFila(): SolicitacaoResumo[] {
  return [
    {
      id: 't1',
      descricao: 'Notebooks para o time de dados',
      status: 'APROVADO',
      cicloAprovacao: 1,
      _count: { orcamentos: 3, itens: 2 },
      ...BASE,
    },
    {
      id: 't2',
      descricao: 'Licenças de antivírus corporativo',
      status: 'COMPRA_EM_ANDAMENTO',
      cicloAprovacao: 1,
      _count: { orcamentos: 3, itens: 1 },
      ...BASE,
    },
    {
      id: 't3',
      descricao: 'Servidores de backup',
      status: 'PAGO',
      cicloAprovacao: 1,
      _count: { orcamentos: 2, itens: 1 },
      ...BASE,
    },
  ]
}

const DETALHE_T1: SolicitacaoDetalhe = {
  id: 't1',
  descricao: 'Notebooks para o time de dados',
  status: 'APROVADO',
  cicloAprovacao: 1,
  solicitanteId: 'u1',
  setorId: 'st1',
  motivoCancelamento: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-10T14:30:00.000Z',
  itens: [
    {
      id: 'i1',
      produto: 'Notebook Dell Latitude',
      quantidade: 2,
      valorUnitarioEstimado: '4899.90',
      createdAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'i2',
      produto: 'Monitor Dell 27',
      quantidade: 2,
      valorUnitarioEstimado: '1250.00',
      createdAt: '2026-09-01T10:00:00.000Z',
    },
  ],
  orcamentos: [],
  _count: { orcamentos: 3, itens: 2 },
}

function resumoComStatus(status: EstadoSolicitacao): SolicitacaoResumo {
  return {
    id: 't9',
    descricao: 'Solicitação de apoio ao teste',
    status,
    cicloAprovacao: 1,
    _count: { orcamentos: 1, itens: 1 },
    ...BASE,
  }
}

function naoEncontrado() {
  return HttpResponse.json({ message: 'Solicitação não encontrada.', statusCode: 404 }, { status: 404 })
}

let fila: SolicitacaoResumo[] = []
let corposCompra: string[] = []
let corposPagamento: { forma: string; dados: string }[] = []
let arquivosNf: (string | null)[] = []

function instalarHandlers() {
  corposCompra = []
  corposPagamento = []
  arquivosNf = []
  server.use(
    http.get('/api/solicitacoes', ({ request }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const status = new URL(request.url).searchParams.get('status')
      return HttpResponse.json(status ? fila.filter((item) => item.status === status) : fila)
    }),
    http.get('/api/solicitacoes/:id', ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      if (String(params.id) === DETALHE_T1.id) return HttpResponse.json(DETALHE_T1)
      return naoEncontrado()
    }),
    http.post('/api/solicitacoes/:id/compra', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      corposCompra.push(await request.text())
      const item = fila.find((solicitacao) => solicitacao.id === String(params.id))
      if (!item) return naoEncontrado()
      item.status = 'COMPRA_EM_ANDAMENTO'
      return HttpResponse.json({ ...item, status: 'COMPRA_EM_ANDAMENTO', orcamentoId: 'o3' })
    }),
    http.post('/api/solicitacoes/:id/pagamento-dados', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      corposPagamento.push((await request.json()) as { forma: string; dados: string })
      const item = fila.find((solicitacao) => solicitacao.id === String(params.id))
      if (!item) return naoEncontrado()
      item.status = 'AGUARDANDO_FINANCEIRO'
      return HttpResponse.json({ ...item, status: 'AGUARDANDO_FINANCEIRO' })
    }),
    http.post('/api/solicitacoes/:id/nf', async ({ request, params }) => {
      if (!autorizado(request)) return respostaNaoAutorizada()
      const formulario = await request.formData()
      const arquivo = formulario.get('arquivo')
      arquivosNf.push(arquivo instanceof ArquivoNode ? arquivo.name : null)
      const item = fila.find((solicitacao) => solicitacao.id === String(params.id))
      if (!item) return naoEncontrado()
      item.status = 'CONCLUIDO'
      return HttpResponse.json({ ...item, status: 'CONCLUIDO' })
    }),
  )
}

beforeEach(() => {
  fila = criarFila()
  instalarHandlers()
})

describe('fila de compras da TI', () => {
  it('renderiza as três filas com a ação correta de cada status', async () => {
    semearSessao('TI')
    renderizarApp('/ti')

    expect(await screen.findByText('Notebooks para o time de dados')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Aprovadas para comprar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Em andamento' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Aguardando NF' })).toBeInTheDocument()
    expect(screen.getByText('Licenças de antivírus corporativo')).toBeInTheDocument()
    expect(screen.getByText('Servidores de backup')).toBeInTheDocument()

    const aprovadas = within(screen.getByTestId('fila-APROVADO'))
    expect(
      aprovadas.getByRole('button', { name: 'Executar compra' }),
    ).toBeInTheDocument()
    expect(aprovadas.queryByRole('button', { name: 'Anexar nota fiscal' })).not.toBeInTheDocument()

    const andamento = within(screen.getByTestId('fila-COMPRA_EM_ANDAMENTO'))
    expect(
      andamento.getByRole('button', { name: 'Registrar dados de pagamento' }),
    ).toBeInTheDocument()

    const aguardandoNf = within(screen.getByTestId('fila-PAGO'))
    expect(
      aguardandoNf.getByRole('button', { name: 'Anexar nota fiscal' }),
    ).toBeInTheDocument()
  })

  it('exibe estado vazio nas filas sem solicitações', async () => {
    fila = fila.filter((item) => item.status === 'APROVADO')
    semearSessao('TI')
    renderizarApp('/ti')

    expect(await screen.findByText('Notebooks para o time de dados')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma compra em andamento')).toBeInTheDocument()
    expect(await screen.findByText('Nenhuma solicitação aguardando nota fiscal')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma solicitação aprovada para comprar')).not.toBeInTheDocument()
  })
})

describe('executar compra', () => {
  it('envia POST sem corpo, avisa sobre orçamento da aprovação e move de fila', async () => {
    const usuario = userEvent.setup()
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Notebooks para o time de dados')
    await usuario.click(screen.getByRole('button', { name: 'Executar compra' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Executar compra' })
    expect(await within(dialogo).findByText('Notebook Dell Latitude')).toBeInTheDocument()
    expect(within(dialogo).getByText('Total estimado')).toBeInTheDocument()
    expect(within(dialogo).getByText('R$ 12.299,80')).toBeInTheDocument()
    expect(
      within(dialogo).getByText('A compra usará o orçamento escolhido pela aprovação financeira.'),
    ).toBeInTheDocument()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar compra' }))

    expect(await screen.findByText('Compra iniciada')).toBeInTheDocument()
    expect(corposCompra).toEqual([''])

    const aprovadas = screen.getByTestId('fila-APROVADO')
    await waitFor(() =>
      expect(within(aprovadas).queryByText('Notebooks para o time de dados')).not.toBeInTheDocument(),
    )
    const andamento = screen.getByTestId('fila-COMPRA_EM_ANDAMENTO')
    expect(
      await within(andamento).findByText('Notebooks para o time de dados'),
    ).toBeInTheDocument()
  })
})

describe('registrar dados de pagamento', () => {
  it('envia dados de boleto no formato correto', async () => {
    const linhaDigitavel = '34191.09008 63541.820047 91020.150008 7 1234567890123456'
    const usuario = userEvent.setup()
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Licenças de antivírus corporativo')
    await usuario.click(screen.getByRole('button', { name: 'Registrar dados de pagamento' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Registrar dados de pagamento' })
    await usuario.type(
      within(dialogo).getByLabelText('Linha digitável / código do boleto'),
      linhaDigitavel,
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar ao Financeiro' }))

    expect(await screen.findByText('Enviado ao Financeiro (AGUARDANDO_FINANCEIRO)')).toBeInTheDocument()
    expect(corposPagamento).toEqual([{ forma: 'BOLETO', dados: linhaDigitavel }])

    const andamento = screen.getByTestId('fila-COMPRA_EM_ANDAMENTO')
    await waitFor(() =>
      expect(within(andamento).queryByText('Licenças de antivírus corporativo')).not.toBeInTheDocument(),
    )
  })

  it('envia dados de PIX no formato correto', async () => {
    const chavePix = '00020126580014br.gov.bcb.pix0136abc-def-ghi-jklmnopqrstuv'
    const usuario = userEvent.setup()
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Licenças de antivírus corporativo')
    await usuario.click(screen.getByRole('button', { name: 'Registrar dados de pagamento' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Registrar dados de pagamento' })
    await usuario.selectOptions(within(dialogo).getByLabelText('Forma de pagamento'), 'PIX')
    expect(
      within(dialogo).queryByLabelText('Linha digitável / código do boleto'),
    ).not.toBeInTheDocument()
    await usuario.type(
      within(dialogo).getByLabelText('Chave PIX / QR Code (copia e cola)'),
      chavePix,
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar ao Financeiro' }))

    expect(await screen.findByText('Enviado ao Financeiro (AGUARDANDO_FINANCEIRO)')).toBeInTheDocument()
    expect(corposPagamento).toEqual([{ forma: 'PIX', dados: chavePix }])
  })

  it('mantém o botão desabilitado enquanto os dados estão vazios', async () => {
    const usuario = userEvent.setup()
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Licenças de antivírus corporativo')
    await usuario.click(screen.getByRole('button', { name: 'Registrar dados de pagamento' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Registrar dados de pagamento' })
    const enviar = within(dialogo).getByRole('button', { name: 'Enviar ao Financeiro' })
    expect(enviar).toBeDisabled()

    const campo = within(dialogo).getByLabelText('Linha digitável / código do boleto')
    await usuario.type(campo, '   ')
    expect(enviar).toBeDisabled()
    expect(corposPagamento).toEqual([])

    await usuario.type(campo, '341910900863541820047')
    expect(enviar).toBeEnabled()
  })
})

describe('anexar nota fiscal', () => {
  it('bloqueia arquivo em formato inválido antes de enviar', async () => {
    const usuario = userEvent.setup({ applyAccept: false })
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Servidores de backup')
    await usuario.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Anexar nota fiscal' })
    await usuario.upload(
      within(dialogo).getByLabelText('Arquivo da nota fiscal'),
      new ArquivoNode(['binario'], 'nota.exe', { type: 'application/octet-stream' }),
    )

    expect(
      within(dialogo).getByText('Formato inválido. Envie um arquivo PDF, PNG, JPG ou JPEG.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Anexar arquivo' })).toBeDisabled()
    expect(arquivosNf).toEqual([])
  })

  it('bloqueia arquivo maior que 10 MB antes de enviar', async () => {
    const usuario = userEvent.setup({ applyAccept: false })
    const grande = new ArquivoNode(['conteudo'], 'nota.pdf', { type: 'application/pdf' })
    Object.defineProperty(grande, 'size', { value: 10 * 1024 * 1024 + 1 })
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Servidores de backup')
    await usuario.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Anexar nota fiscal' })
    await usuario.upload(within(dialogo).getByLabelText('Arquivo da nota fiscal'), grande)

    expect(
      within(dialogo).getByText('Arquivo muito grande. Envie um arquivo de até 10 MB.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Anexar arquivo' })).toBeDisabled()
    expect(arquivosNf).toEqual([])
  })

  it('anexa a NF com multipart, conclui a compra e sai da fila', async () => {
    const usuario = userEvent.setup()
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Servidores de backup')
    await usuario.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Anexar nota fiscal' })
    await usuario.upload(
      within(dialogo).getByLabelText('Arquivo da nota fiscal'),
      new ArquivoNode(['%PDF-1.4'], 'nota.pdf', { type: 'application/pdf' }),
    )
    expect(within(dialogo).getByText('Selecionado: nota.pdf')).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Anexar arquivo' }))

    expect(await screen.findByText('Nota fiscal anexada — compra concluída')).toBeInTheDocument()
    expect(arquivosNf).toEqual(['nota.pdf'])

    const aguardandoNf = screen.getByTestId('fila-PAGO')
    await waitFor(() =>
      expect(within(aguardandoNf).queryByText('Servidores de backup')).not.toBeInTheDocument(),
    )
  })

  it('exibe a mensagem do backend quando a NF exige comprovante (422)', async () => {
    server.use(
      http.post('/api/solicitacoes/:id/nf', ({ request }) => {
        if (!autorizado(request)) return respostaNaoAutorizada()
        return HttpResponse.json(
          { message: 'Anexe o comprovante de pagamento antes de enviar a nota fiscal.', statusCode: 422 },
          { status: 422 },
        )
      }),
    )
    const usuario = userEvent.setup()
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Servidores de backup')
    await usuario.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Anexar nota fiscal' })
    await usuario.upload(
      within(dialogo).getByLabelText('Arquivo da nota fiscal'),
      new ArquivoNode(['%PDF-1.4'], 'nota.pdf', { type: 'application/pdf' }),
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Anexar arquivo' }))

    expect(
      await screen.findByText('Anexe o comprovante de pagamento antes de enviar a nota fiscal.'),
    ).toBeInTheDocument()
  })

  it('exibe a mensagem do backend em conflito de estado (409)', async () => {
    server.use(
      http.post('/api/solicitacoes/:id/nf', ({ request }) => {
        if (!autorizado(request)) return respostaNaoAutorizada()
        return HttpResponse.json(
          { message: 'Nota fiscal já anexada para esta solicitação.', statusCode: 409 },
          { status: 409 },
        )
      }),
    )
    const usuario = userEvent.setup()
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Servidores de backup')
    await usuario.click(screen.getByRole('button', { name: 'Anexar nota fiscal' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Anexar nota fiscal' })
    await usuario.upload(
      within(dialogo).getByLabelText('Arquivo da nota fiscal'),
      new ArquivoNode(['%PDF-1.4'], 'nota.pdf', { type: 'application/pdf' }),
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Anexar arquivo' }))

    expect(await screen.findByText('Nota fiscal já anexada para esta solicitação.')).toBeInTheDocument()
  })
})

describe('restrições da UI da TI', () => {
  it('não oferece nenhuma ação de pagamento à TI', async () => {
    semearSessao('TI')
    renderizarApp('/ti')

    await screen.findByText('Notebooks para o time de dados')
    expect(screen.queryByRole('button', { name: /pagar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /efetuar pagamento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marcar como pago/i })).not.toBeInTheDocument()

    const { container } = render(
      <ToasterProvider>
        <PainelTi solicitacao={resumoComStatus('AGUARDANDO_FINANCEIRO')} />
        <PainelTi solicitacao={resumoComStatus('CONCLUIDO')} />
        <PainelTi solicitacao={resumoComStatus('PAGO')} />
      </ToasterProvider>,
    )
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(
      within(container).getByRole('button', { name: 'Anexar nota fiscal' }),
    ).toBeInTheDocument()
    expect(within(container).queryByRole('button', { name: /pagar/i })).not.toBeInTheDocument()
  })
})
