import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, api, apiDownload } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardTitulo } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Stepper } from '../../components/ui/Stepper'
import { useToaster } from '../../components/ui/ToasterContext'
import { formatarCnpj, formatarData, formatarDataHora, formatarMoeda } from '../../lib/format'
import type {
  DocumentoSolicitacao,
  SetorResumo,
  SolicitacaoDetalhe,
  TipoDocumento,
  Usuario,
} from '../../types/api'
import { AcoesSolicitante } from './components/AcoesSolicitante'
import { AnexoDocumentoOrcamento } from './components/AnexoDocumentoOrcamento'
import { PainelDecisao } from '../aprovacoes/components/PainelDecisao'
import { PainelPagador } from '../pagamentos/components/PainelPagador'
import { PainelTi } from '../ti/components/PainelTi'
import { acaoTiParaStatus } from '../ti/components/acaoTi'

const SLUGS_PRIMEIRO_NIVEL_GF: string[] = ['OFICINA', 'TI']

const ROTULOS_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  ORCAMENTO: 'Orçamento',
  COMPROVANTE_PAGAMENTO: 'Comprovante de pagamento',
  NOTA_FISCAL: 'Nota fiscal',
}

function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const unidades = ['KB', 'MB', 'GB']
  let valor = bytes / 1024
  let indice = 0
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024
    indice += 1
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unidades[indice]}`
}

interface PainelAcoes {
  conteudo: ReactNode
  envolverEmCard: boolean
}

function painelPorRegra(
  usuario: Usuario,
  solicitacao: SolicitacaoDetalhe,
  aoAtualizar: () => void,
): PainelAcoes | null {
  if (usuario.perfil === 'SOLICITANTE' && usuario.id === solicitacao.solicitanteId) {
    return { conteudo: <AcoesSolicitante solicitacao={solicitacao} onAtualizar={aoAtualizar} />, envolverEmCard: false }
  }

  if (solicitacao.status === 'AGUARDANDO_APROVACAO_SETOR') {
    if (usuario.perfil === 'GERENTE' && usuario.setorId === solicitacao.setorId) {
      return {
        conteudo: <PainelDecisao solicitacao={solicitacao} nivel="SETOR" aoConcluir={aoAtualizar} />,
        envolverEmCard: true,
      }
    }
    if (
      usuario.perfil === 'GERENTE_FINANCEIRA' &&
      SLUGS_PRIMEIRO_NIVEL_GF.includes(solicitacao.setor?.slug ?? '')
    ) {
      return {
        conteudo: <PainelDecisao solicitacao={solicitacao} nivel="SETOR" aoConcluir={aoAtualizar} />,
        envolverEmCard: true,
      }
    }
    return null
  }

  if (solicitacao.status === 'AGUARDANDO_APROVACAO_FINANCEIRA') {
    if (usuario.perfil === 'GERENTE_FINANCEIRA') {
      return {
        conteudo: <PainelDecisao solicitacao={solicitacao} nivel="FINANCEIRA" aoConcluir={aoAtualizar} />,
        envolverEmCard: true,
      }
    }
    return null
  }

  if (usuario.perfil === 'TI' && acaoTiParaStatus(solicitacao.status) !== null) {
    return { conteudo: <PainelTi solicitacao={solicitacao} aoAcaoConcluida={aoAtualizar} />, envolverEmCard: true }
  }

  const podePagar =
    (usuario.perfil === 'GERENTE_FINANCEIRA' || usuario.perfil === 'FINANCEIRO') &&
    (solicitacao.status === 'AGUARDANDO_FINANCEIRO' ||
      solicitacao.status === 'PAGO' ||
      solicitacao.status === 'CONCLUIDO') &&
    solicitacao.pagamento != null

  if (podePagar) {
    return {
      conteudo: (
        <PainelPagador
          pagamento={solicitacao.pagamento}
          status={solicitacao.status}
          podePagar={solicitacao.status === 'AGUARDANDO_FINANCEIRO'}
          onPago={aoAtualizar}
        />
      ),
      envolverEmCard: true,
    }
  }

  return null
}

function SecaoAcoes({
  usuario,
  solicitacao,
  aoAtualizar,
}: {
  usuario: Usuario
  solicitacao: SolicitacaoDetalhe
  aoAtualizar: () => void
}) {
  const painel = painelPorRegra(usuario, solicitacao, aoAtualizar)
  if (painel === null) return null
  return (
    <section aria-label="Ações da solicitação">
      {painel.envolverEmCard ? (
        <Card className="p-4">
          <CardTitulo>Ações</CardTitulo>
          <div className="mt-3">{painel.conteudo}</div>
        </Card>
      ) : (
        painel.conteudo
      )}
    </section>
  )
}

function DocumentosSection({ documentos }: { documentos: DocumentoSolicitacao[] }) {
  const toaster = useToaster()
  const [baixandoId, setBaixandoId] = useState<string | null>(null)

  async function baixar(documento: DocumentoSolicitacao): Promise<void> {
    setBaixandoId(documento.id)
    try {
      const { blob } = await apiDownload(`/documentos/${documento.id}`)
      const url = URL.createObjectURL(blob)
      const ancora = document.createElement('a')
      ancora.href = url
      ancora.download = documento.nomeOriginal
      document.body.appendChild(ancora)
      ancora.click()
      ancora.remove()
      URL.revokeObjectURL(url)
    } catch (erro) {
      toaster.erro(erro instanceof ApiError && erro.message ? erro.message : 'Não foi possível baixar o documento.')
    } finally {
      setBaixandoId(null)
    }
  }

  return (
    <Card className="p-4">
      <CardTitulo>Documentos</CardTitulo>
      {documentos.length === 0 ? (
        <EmptyState
          titulo="Documentos do orçamento"
          descricao="Nenhum documento anexado a esta solicitação até o momento."
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {documentos.map((documento) => (
            <li
              key={documento.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge tom="azul">{ROTULOS_TIPO_DOCUMENTO[documento.tipo]}</Badge>
                <span className="truncate text-sm font-medium text-slate-900">{documento.nomeOriginal}</span>
                <span className="text-xs text-slate-500">{formatarTamanho(documento.tamanhoBytes)}</span>
              </div>
              <Button
                variante="secundario"
                disabled={baixandoId === documento.id}
                onClick={() => void baixar(documento)}
              >
                {baixandoId === documento.id ? 'Baixando...' : 'Baixar'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function setorDoCabecalho(setor: SetorResumo | null | undefined): ReactNode {
  if (!setor) return null
  return <Badge tom="azul">{setor.nome}</Badge>
}

export default function SolicitacaoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const [solicitacao, setSolicitacao] = useState<SolicitacaoDetalhe | null>(null)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    if (!id) return
    api<SolicitacaoDetalhe>(`/solicitacoes/${id}`)
      .then((dados) => {
        if (ativo) {
          setSolicitacao(dados)
          setErro('')
        }
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar a solicitação.')
      })
    return () => {
      ativo = false
    }
  }, [id, versao])

  if (erro) {
    return (
      <div>
        <PageHeader titulo="Solicitação" />
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
        <Link to="/solicitacoes" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
          Voltar para a lista
        </Link>
      </div>
    )
  }

  if (!solicitacao) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const totalItens = solicitacao.itens.reduce(
    (total, item) => total + item.quantidade * Number(item.valorUnitarioEstimado),
    0,
  )

  const aoAtualizar = () => setVersao((atual) => atual + 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={`Solicitação ${solicitacao.id}`}
        descricao={`Criada em ${formatarDataHora(solicitacao.createdAt)}`}
        acoes={
          <>
            {setorDoCabecalho(solicitacao.setor)}
            <StatusBadge status={solicitacao.status} />
            <Badge tom="azul">Ciclo {solicitacao.cicloAprovacao}</Badge>
          </>
        }
      />

      {solicitacao.motivoCancelamento ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Motivo do cancelamento: {solicitacao.motivoCancelamento}
        </p>
      ) : null}

      {usuario ? <SecaoAcoes usuario={usuario} solicitacao={solicitacao} aoAtualizar={aoAtualizar} /> : null}

      <Card className="p-4">
        <CardTitulo>Fluxo da solicitação</CardTitulo>
        <div className="mt-3">
          <Stepper status={solicitacao.status} />
        </div>
      </Card>

      <Card className="p-4">
        <CardTitulo>Descrição</CardTitulo>
        <p className="mt-2 text-sm text-slate-600">{solicitacao.descricao}</p>
      </Card>

      <Card className="p-4">
        <CardTitulo>Itens</CardTitulo>
        {solicitacao.itens.length === 0 ? (
          <EmptyState titulo="Nenhum item cadastrado" />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Quantidade</th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Valor unitário</th>
                  <th scope="col" className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {solicitacao.itens.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-sm text-slate-700">{item.produto}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{item.quantidade}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{formatarMoeda(item.valorUnitarioEstimado)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      {formatarMoeda(item.quantidade * Number(item.valorUnitarioEstimado))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-slate-900">Total estimado</td>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-900">{formatarMoeda(totalItens)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <CardTitulo>Orçamentos</CardTitulo>
        {solicitacao.orcamentos.length === 0 ? (
          <EmptyState titulo="Nenhum orçamento anexado" />
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {solicitacao.orcamentos.map((orcamento) => (
              <li key={orcamento.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-slate-900">{formatarMoeda(orcamento.valor)}</p>
                  <p className="text-xs text-slate-500">
                    CNPJ: <span>{formatarCnpj(orcamento.cnpjLoja)}</span>
                  </p>
                  <p className="text-xs text-slate-500">Anexado em {formatarDataHora(orcamento.createdAt)}</p>
                  {orcamento.validadeAte ? (
                    <p className="text-xs text-amber-700">
                      Válido até <span>{formatarData(orcamento.validadeAte)}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={orcamento.linkLoja}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Abrir loja
                  </a>
                  <AnexoDocumentoOrcamento
                    solicitacao={solicitacao}
                    orcamento={orcamento}
                    onAtualizar={aoAtualizar}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DocumentosSection documentos={solicitacao.documentos ?? []} />

      <div>
        <Link to="/solicitacoes" className="text-sm font-medium text-blue-600 hover:underline">
          Voltar para a lista
        </Link>
      </div>
    </div>
  )
}
