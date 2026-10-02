import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { CHAVE_SESSAO } from '../../api/client'
import { renderizarApp, semearSessao } from '../../test/utils'
import { autorizado, respostaNaoAutorizada } from '../../test/handlers'
import { server } from '../../test/server'
import type { PagamentoInfo, SolicitacaoDetalhe } from '../../types/api'

const SETOR_TI = { id: 'st1', slug: 'TI', nome: 'Tecnologia da Informação' }
const SETOR_OFICINA = { id: 'st5', slug: 'OFICINA', nome: 'Oficina' }
const SETOR_MKT = { id: 'st6', slug: 'MKT', nome: 'Marketing' }

const PAGAMENTO_BOLETO: PagamentoInfo = {
  id: 'pg-1',
  forma: 'BOLETO',
  dados: '34191.79001 01043.510047 91020.150008 3 91960000012935',
  valorPago: null,
  pagoEm: null,
}

const PAGAMENTO_PAGO: PagamentoInfo = {
  id: 'pg-2',
  forma: 'PIX',
  dados: 'chave-pix-demo',
  valorPago: '1250.50',
  pagoEm: '2026-09-22T12:00:00.000Z',
}

const criarObjectUrl = vi.fn(() => 'blob:http://localhost/documento-1')
const revogarObjectUrl = vi.fn()

const FormDataJsdom = globalThis.FormData
let ArquivoNode: typeof File

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: criarObjectUrl, configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revogarObjectUrl, configurable: true })
})

function criarDetalhe(parcial: Partial<SolicitacaoDetalhe> = {}): SolicitacaoDetalhe {
  return {
    id: 's1',
    descricao: 'Compra de teclado mecânico',
    status: 'RASCUNHO',
    cicloAprovacao: 1,
    solicitanteId: 'u1',
    setorId: 'st1',
    motivoCancelamento: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-10T14:30:00.000Z',
    itens: [
      {
        id: 'i1',
        produto: 'Teclado mecânico ABNT2',
        quantidade: 1,
        valorUnitarioEstimado: '250.00',
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    ],
    orcamentos: [
      {
        id: 'o1',
        linkLoja: 'https://loja.example.com/teclado',
        cnpjLoja: '12345678000199',
        valor: '250.00',
        validadeAte: null,
        createdAt: '2026-09-02T09:00:00.000Z',
      },
    ],
    _count: { orcamentos: 1, itens: 1 },
    ...parcial,
  }
}

function instalarDetalhe(detalhe: SolicitacaoDetalhe): void {
  server.use(
    http.get('/api/solicitacoes/:id', ({ request, params }) => {
      if (!autorizado(request)) {
        return respostaNaoAutorizada()
      }
      if (params.id !== detalhe.id) {
        return HttpResponse.json(
          { message: 'Solicitação não encontrada.', statusCode: 404 },
          { status: 404 },
        )
      }
      return HttpResponse.json(detalhe)
    }),
  )
}

describe('integração do detalhe — painéis por perfil, status e setor', () => {
  it('solicitante dono em rascunho vê as ações do solicitante', async () => {
    instalarDetalhe(criarDetalhe({ status: 'RASCUNHO' }))
    semearSessao('SOLICITANTE')
    renderizarApp('/solicitacoes/s1')

    expect(await screen.findByText('Ações do solicitante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar orçamento (1/3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('usuário sem regra aplicável não vê seção de ações', async () => {
    instalarDetalhe(criarDetalhe({ status: 'RASCUNHO' }))
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s1')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByText('Ações')).not.toBeInTheDocument()
    expect(screen.queryByText('Ações do solicitante')).not.toBeInTheDocument()
  })

  it('gerente do setor decide o primeiro nível em aguardando aprovação do setor', async () => {
    instalarDetalhe(
      criarDetalhe({ id: 's3', status: 'AGUARDANDO_APROVACAO_SETOR', setor: SETOR_TI }),
    )
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s3')

    expect(await screen.findByText('Ações')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprovar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Devolver para correção' })).toBeInTheDocument()
  })

  it('gerente de outro setor não vê painel de decisão', async () => {
    instalarDetalhe(
      criarDetalhe({
        id: 's4',
        status: 'AGUARDANDO_APROVACAO_SETOR',
        setorId: 'st9',
        setor: SETOR_MKT,
      }),
    )
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s4')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByText('Ações')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
  })

  it('gerente financeira aprova o primeiro nível em setor da oficina (DEC-019)', async () => {
    instalarDetalhe(
      criarDetalhe({
        id: 's5',
        status: 'AGUARDANDO_APROVACAO_SETOR',
        setorId: 'st5',
        setor: SETOR_OFICINA,
      }),
    )
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/solicitacoes/s5')

    expect(await screen.findByText('Ações')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Devolver para correção' })).toBeInTheDocument()
  })

  it('gerente financeira não aprova o primeiro nível em setor de marketing (DEC-019)', async () => {
    instalarDetalhe(
      criarDetalhe({
        id: 's6',
        status: 'AGUARDANDO_APROVACAO_SETOR',
        setorId: 'st6',
        setor: SETOR_MKT,
      }),
    )
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/solicitacoes/s6')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByText('Ações')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
  })

  it('gerente financeira decide o nível financeiro sem devolução', async () => {
    instalarDetalhe(
      criarDetalhe({ id: 's7', status: 'AGUARDANDO_APROVACAO_FINANCEIRA', setor: SETOR_TI }),
    )
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/solicitacoes/s7')

    expect(await screen.findByText('Ações')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reprovar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Devolver para correção' })).not.toBeInTheDocument()
  })

  it('gerente não decide o nível financeiro', async () => {
    instalarDetalhe(
      criarDetalhe({ id: 's8', status: 'AGUARDANDO_APROVACAO_FINANCEIRA', setor: SETOR_TI }),
    )
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s8')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByText('Ações')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument()
  })

  it('TI vê a ação de compra em aprovado', async () => {
    instalarDetalhe(criarDetalhe({ id: 's9', status: 'APROVADO', setor: SETOR_TI }))
    semearSessao('TI')
    renderizarApp('/solicitacoes/s9')

    expect(await screen.findByText('Ações')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Executar compra' })).toBeInTheDocument()
  })

  it('financeiro vê o painel do pagador em aguardando financeiro', async () => {
    instalarDetalhe(
      criarDetalhe({ id: 's10', status: 'AGUARDANDO_FINANCEIRO', pagamento: PAGAMENTO_BOLETO }),
    )
    semearSessao('FINANCEIRO')
    renderizarApp('/solicitacoes/s10')

    expect(await screen.findByText('Ações')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar pagamento' })).toBeInTheDocument()
    expect(screen.getByText('Boleto')).toBeInTheDocument()
    expect(screen.getByText(PAGAMENTO_BOLETO.dados)).toBeInTheDocument()
  })

  it('TI não vê o painel do pagador em aguardando financeiro', async () => {
    instalarDetalhe(
      criarDetalhe({ id: 's11', status: 'AGUARDANDO_FINANCEIRO', pagamento: PAGAMENTO_BOLETO }),
    )
    semearSessao('TI')
    renderizarApp('/solicitacoes/s11')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByText('Ações')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument()
    expect(screen.queryByText(PAGAMENTO_BOLETO.dados)).not.toBeInTheDocument()
  })

  it('gerente financeira em pago vê o pagamento concluído sem botão de pagar', async () => {
    instalarDetalhe(
      criarDetalhe({ id: 's12', status: 'PAGO', pagamento: PAGAMENTO_PAGO }),
    )
    semearSessao('GERENTE_FINANCEIRA')
    renderizarApp('/solicitacoes/s12')

    expect(await screen.findByText('Ações')).toBeInTheDocument()
    expect(screen.getByText('Pago em 22/09/2026')).toBeInTheDocument()
    expect(screen.getByText('R$ 1.250,50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).not.toBeInTheDocument()
  })

  it('recarrega o detalhe após decisão do gerente', async () => {
    const detalhe = criarDetalhe({
      id: 's13',
      status: 'AGUARDANDO_APROVACAO_SETOR',
      setor: SETOR_TI,
    })
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    server.use(
      http.get('/api/solicitacoes/:id', ({ request, params }) => {
        if (!autorizado(request)) {
          return respostaNaoAutorizada()
        }
        if (params.id !== detalhe.id) {
          return HttpResponse.json(
            { message: 'Solicitação não encontrada.', statusCode: 404 },
            { status: 404 },
          )
        }
        return HttpResponse.json(detalhe)
      }),
      http.post('/api/solicitacoes/:id/decisao', ({ request }) => {
        if (!autorizado(request)) {
          return respostaNaoAutorizada()
        }
        detalhe.status = 'AGUARDANDO_APROVACAO_FINANCEIRA'
        return HttpResponse.json({ status: detalhe.status })
      }),
    )
    renderizarApp('/solicitacoes/s13')

    await usuario.click(await screen.findByRole('radio', { name: /250,00/ }))
    await usuario.click(screen.getByRole('button', { name: 'Aprovar' }))

    expect(await screen.findByText('Aprovada e registrada.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Ações')).not.toBeInTheDocument())
    expect(screen.getByTestId('etapa-atual')).toHaveTextContent('Aguardando aprovação financeira')
  })

  it('exibe o nome do setor no cabeçalho do detalhe', async () => {
    instalarDetalhe(
      criarDetalhe({ id: 's14', status: 'AGUARDANDO_APROVACAO_SETOR', setor: SETOR_TI }),
    )
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s14')

    expect(await screen.findByText('Tecnologia da Informação')).toBeInTheDocument()
  })

  it('exibe o motivo do cancelamento em solicitação cancelada', async () => {
    instalarDetalhe(
      criarDetalhe({
        id: 's15',
        status: 'CANCELADO',
        motivoCancelamento: 'Orçamento venceu antes da aprovação.',
      }),
    )
    semearSessao('SOLICITANTE')
    renderizarApp('/solicitacoes/s15')

    expect(await screen.findByText('Motivo do cancelamento: Orçamento venceu antes da aprovação.')).toBeInTheDocument()
  })
})

describe('documentos do detalhe', () => {
  it('lista documentos por tipo com botão de baixar', async () => {
    instalarDetalhe(
      criarDetalhe({
        id: 's16',
        documentos: [
          {
            id: 'd1',
            tipo: 'ORCAMENTO',
            nomeOriginal: 'orcamento-v1.pdf',
            mimeType: 'application/pdf',
            tamanhoBytes: 1536,
          },
          {
            id: 'd2',
            tipo: 'NOTA_FISCAL',
            nomeOriginal: 'nota-fiscal.png',
            mimeType: 'image/png',
            tamanhoBytes: 5242880,
          },
        ],
      }),
    )
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s16')

    expect(await screen.findByText('orcamento-v1.pdf')).toBeInTheDocument()
    expect(screen.getByText('nota-fiscal.png')).toBeInTheDocument()
    expect(screen.getByText('Orçamento')).toBeInTheDocument()
    expect(screen.getByText('Nota fiscal')).toBeInTheDocument()
    expect(screen.getByText('1,5 KB')).toBeInTheDocument()
    expect(screen.getByText('5 MB')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Baixar' })).toHaveLength(2)
  })

  it('baixa o documento via apiDownload com link temporário', async () => {
    const urls: string[] = []
    server.use(
      http.get('/api/documentos/:id', ({ request, params }) => {
        if (!autorizado(request)) {
          return respostaNaoAutorizada()
        }
        urls.push(String(params.id))
        return new HttpResponse('conteudo-do-arquivo', {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="orcamento-v1.pdf"',
          },
        })
      }),
    )
    const cliques: HTMLAnchorElement[] = []
    const clicar = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        cliques.push(this)
      })
    criarObjectUrl.mockClear()
    revogarObjectUrl.mockClear()
    instalarDetalhe(
      criarDetalhe({
        id: 's17',
        documentos: [
          {
            id: 'd1',
            tipo: 'ORCAMENTO',
            nomeOriginal: 'orcamento-v1.pdf',
            mimeType: 'application/pdf',
            tamanhoBytes: 2048,
          },
        ],
      }),
    )
    const usuario = userEvent.setup()
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s17')

    await usuario.click(await screen.findByRole('button', { name: 'Baixar' }))

    await waitFor(() => expect(urls).toEqual(['d1']))
    expect(criarObjectUrl).toHaveBeenCalledTimes(1)
    expect(cliques).toHaveLength(1)
    expect(cliques[0].download).toBe('orcamento-v1.pdf')
    expect(cliques[0].href).toContain('blob:http://localhost/documento-1')
    expect(revogarObjectUrl).toHaveBeenCalledWith('blob:http://localhost/documento-1')
    clicar.mockRestore()
  })

  it('exibe estado vazio quando não há documentos', async () => {
    instalarDetalhe(criarDetalhe({ id: 's18' }))
    semearSessao('GERENTE')
    renderizarApp('/solicitacoes/s18')

    expect(await screen.findByText('Documentos do orçamento')).toBeInTheDocument()
    expect(
      screen.getByText('Nenhum documento anexado a esta solicitação até o momento.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Baixar' })).not.toBeInTheDocument()
  })
})

describe('anexo de documento do orçamento (RF-18)', () => {
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

  it('dono em rascunho anexa pdf do orçamento via multipart e recarrega o detalhe', async () => {
    const detalhe = criarDetalhe({ id: 's20', status: 'RASCUNHO' })
    let leituras = 0
    const anexos: { arquivo: string | null; orcamentoId: string | null }[] = []
    semearSessao('SOLICITANTE')
    server.use(
      http.get('/api/solicitacoes/:id', ({ request, params }) => {
        if (!autorizado(request)) return respostaNaoAutorizada()
        if (params.id !== detalhe.id) {
          return HttpResponse.json(
            { message: 'Solicitação não encontrada.', statusCode: 404 },
            { status: 404 },
          )
        }
        leituras += 1
        return HttpResponse.json(detalhe)
      }),
      http.post(
        '/api/solicitacoes/:id/orcamentos/:orcamentoId/documento',
        async ({ request, params }) => {
          if (!autorizado(request)) return respostaNaoAutorizada()
          const formulario = await request.formData()
          const arquivo = formulario.get('arquivo')
          anexos.push({
            arquivo: arquivo instanceof ArquivoNode ? arquivo.name : null,
            orcamentoId: String(params.orcamentoId),
          })
          detalhe.documentos = [
            {
              id: 'd20',
              tipo: 'ORCAMENTO',
              nomeOriginal: 'orcamento.pdf',
              mimeType: 'application/pdf',
              tamanhoBytes: 1024,
            },
          ]
          return HttpResponse.json({ id: 'd20' }, { status: 201 })
        },
      ),
    )
    const usuario = userEvent.setup()
    renderizarApp('/solicitacoes/s20')

    await usuario.click(await screen.findByRole('button', { name: 'Anexar PDF do orçamento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Anexar PDF do orçamento' })
    await usuario.upload(
      within(dialogo).getByLabelText('Arquivo do orçamento'),
      new ArquivoNode(['%PDF-1.4'], 'orcamento.pdf', { type: 'application/pdf' }),
    )
    expect(within(dialogo).getByText('Selecionado: orcamento.pdf')).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Anexar arquivo' }))

    expect(await screen.findByText('Documento do orçamento anexado.')).toBeInTheDocument()
    expect(anexos).toEqual([{ arquivo: 'orcamento.pdf', orcamentoId: 'o1' }])
    expect(await screen.findByText('orcamento.pdf')).toBeInTheDocument()
    expect(screen.getByText('1 KB')).toBeInTheDocument()
    expect(leituras).toBe(2)
  })

  it('solicitante que não é o dono não vê o botão de anexar', async () => {
    instalarDetalhe(criarDetalhe({ id: 's21', status: 'RASCUNHO' }))
    localStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
        usuario: {
          id: 'u9',
          nome: 'Ana Torres',
          email: 'ana.torres@empresa.com',
          perfil: 'SOLICITANTE',
          setorId: 'st1',
        },
      }),
    )
    renderizarApp('/solicitacoes/s21')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anexar PDF do orçamento' })).not.toBeInTheDocument()
  })

  it('rejeita arquivo executável no cliente sem enviar ao backend', async () => {
    const envios: number[] = []
    instalarDetalhe(criarDetalhe({ id: 's22', status: 'RASCUNHO' }))
    server.use(
      http.post(
        '/api/solicitacoes/:id/orcamentos/:orcamentoId/documento',
        async ({ request }) => {
          if (!autorizado(request)) return respostaNaoAutorizada()
          envios.push(1)
          return HttpResponse.json({ id: 'd22' }, { status: 201 })
        },
      ),
    )
    const usuario = userEvent.setup({ applyAccept: false })
    semearSessao('SOLICITANTE')
    renderizarApp('/solicitacoes/s22')

    await usuario.click(await screen.findByRole('button', { name: 'Anexar PDF do orçamento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Anexar PDF do orçamento' })
    await usuario.upload(
      within(dialogo).getByLabelText('Arquivo do orçamento'),
      new ArquivoNode(['MZ'], 'orcamento.exe', { type: 'application/x-msdownload' }),
    )

    expect(
      within(dialogo).getByText('Formato inválido. Envie um arquivo PDF, PNG, JPG ou JPEG.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Anexar arquivo' })).toBeDisabled()
    expect(envios).toEqual([])
  })

  it('TI não vê o botão de anexar documento do orçamento', async () => {
    instalarDetalhe(criarDetalhe({ id: 's23', status: 'APROVADO', setor: SETOR_TI }))
    semearSessao('TI')
    renderizarApp('/solicitacoes/s23')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anexar PDF do orçamento' })).not.toBeInTheDocument()
  })

  it('dono não vê o botão após o início da compra (DEC-027)', async () => {
    instalarDetalhe(criarDetalhe({ id: 's24', status: 'COMPRA_EM_ANDAMENTO' }))
    semearSessao('SOLICITANTE')
    renderizarApp('/solicitacoes/s24')

    expect(await screen.findByText('Teclado mecânico ABNT2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anexar PDF do orçamento' })).not.toBeInTheDocument()
    expect(screen.getByText('Solicitação bloqueada para edição (DEC-027).')).toBeInTheDocument()
  })

  it('dono em aprovado vê aviso de reabertura do ciclo no confirmar', async () => {
    instalarDetalhe(criarDetalhe({ id: 's25', status: 'APROVADO', setor: SETOR_TI }))
    const usuario = userEvent.setup()
    semearSessao('SOLICITANTE')
    renderizarApp('/solicitacoes/s25')

    await usuario.click(await screen.findByRole('button', { name: 'Anexar PDF do orçamento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Anexar PDF do orçamento' })
    expect(
      within(dialogo).getByText('Atenção: isto reabre o ciclo de aprovação.'),
    ).toBeInTheDocument()
  })
})
