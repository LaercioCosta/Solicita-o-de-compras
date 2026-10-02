import { useEffect, useState, type ChangeEvent } from 'react'
import { ApiError, api, apiUpload } from '../../../api/client'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { Select } from '../../../components/ui/Select'
import { SkeletonLinhas } from '../../../components/ui/Skeleton'
import { useToaster } from '../../../components/ui/ToasterContext'
import { formatarMoeda } from '../../../lib/format'
import type { FormaPagamento, SolicitacaoDetalhe, SolicitacaoResumo } from '../../../types/api'
import { ROTULOS_ACAO_TI, acaoTiParaStatus } from './acaoTi'

const AVISO_ORCAMENTO = 'A compra usará o orçamento escolhido pela aprovação financeira.'
const EXTENSOES_NF = ['pdf', 'png', 'jpg', 'jpeg']
const TAMANHO_MAXIMO_NF = 10 * 1024 * 1024

function mensagemErro(erro: unknown, padrao: string): string {
  if (erro instanceof ApiError && erro.message) return erro.message
  if (erro instanceof Error && erro.message) return erro.message
  return padrao
}

interface PropsModalAcao {
  solicitacao: SolicitacaoResumo
  aoFechar: () => void
  aoConcluir: () => void
}

function ModalCompraTi({ solicitacao, aoFechar, aoConcluir }: PropsModalAcao) {
  const toaster = useToaster()
  const [detalhe, setDetalhe] = useState<SolicitacaoDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [falhou, setFalhou] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    api<SolicitacaoDetalhe>(`/solicitacoes/${solicitacao.id}`)
      .then((dados) => {
        if (!ativo) return
        setDetalhe(dados)
        setCarregando(false)
      })
      .catch(() => {
        if (!ativo) return
        setFalhou(true)
        setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [solicitacao.id])

  const totalEstimado = (detalhe?.itens ?? []).reduce(
    (total, item) => total + item.quantidade * Number(item.valorUnitarioEstimado),
    0,
  )

  async function confirmarCompra() {
    setEnviando(true)
    try {
      await api(`/solicitacoes/${solicitacao.id}/compra`, { method: 'POST' })
      toaster.sucesso('Compra iniciada')
      aoConcluir()
    } catch (erro) {
      toaster.erro(mensagemErro(erro, 'Não foi possível iniciar a compra.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo="Executar compra"
      aoFechar={aoFechar}
      acoes={
        <>
          <Button variante="secundario" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmarCompra} disabled={enviando || carregando}>
            {enviando ? 'Iniciando…' : 'Confirmar compra'}
          </Button>
        </>
      }
    >
      {carregando ? (
        <SkeletonLinhas linhas={3} colunas={2} />
      ) : falhou ? (
        <p className="text-sm text-red-700">Não foi possível carregar o resumo da solicitação.</p>
      ) : detalhe ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-slate-900">{detalhe.descricao}</p>
          <ul className="flex flex-col gap-2">
            {detalhe.itens.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-700">
                  {item.produto}{' '}
                  <span className="text-slate-500">
                    ({item.quantidade}x {formatarMoeda(item.valorUnitarioEstimado)})
                  </span>
                </span>
                <span className="font-medium text-slate-900">
                  {formatarMoeda(item.quantidade * Number(item.valorUnitarioEstimado))}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
            <span>Total estimado</span>
            <span>{formatarMoeda(totalEstimado)}</span>
          </p>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            {AVISO_ORCAMENTO}
          </p>
        </div>
      ) : null}
    </Modal>
  )
}

const ROTULOS_DADOS: Record<FormaPagamento, string> = {
  BOLETO: 'Linha digitável / código do boleto',
  PIX: 'Chave PIX / QR Code (copia e cola)',
}

function ModalPagamentoTi({ solicitacao, aoFechar, aoConcluir }: PropsModalAcao) {
  const toaster = useToaster()
  const [forma, setForma] = useState<FormaPagamento>('BOLETO')
  const [dados, setDados] = useState('')
  const [enviando, setEnviando] = useState(false)
  const dadosValidos = dados.trim().length > 0

  async function enviarDados() {
    if (!dadosValidos || enviando) return
    setEnviando(true)
    try {
      await api(`/solicitacoes/${solicitacao.id}/pagamento-dados`, {
        method: 'POST',
        body: JSON.stringify({ forma, dados: dados.trim() }),
      })
      toaster.sucesso('Enviado ao Financeiro (AGUARDANDO_FINANCEIRO)')
      aoConcluir()
    } catch (erro) {
      toaster.erro(mensagemErro(erro, 'Não foi possível enviar os dados de pagamento.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo="Registrar dados de pagamento"
      aoFechar={aoFechar}
      acoes={
        <>
          <Button variante="secundario" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviarDados} disabled={enviando || !dadosValidos}>
            {enviando ? 'Enviando…' : 'Enviar ao Financeiro'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Forma de pagamento"
          id={`forma-pagamento-${solicitacao.id}`}
          value={forma}
          onChange={(evento) => setForma(evento.target.value as FormaPagamento)}
        >
          <option value="BOLETO">Boleto</option>
          <option value="PIX">PIX</option>
        </Select>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`dados-pagamento-${solicitacao.id}`}
            className="text-sm font-medium text-slate-700"
          >
            {ROTULOS_DADOS[forma]}
          </label>
          <textarea
            id={`dados-pagamento-${solicitacao.id}`}
            rows={4}
            maxLength={10000}
            value={dados}
            onChange={(evento) => setDados(evento.target.value)}
            placeholder={
              forma === 'BOLETO'
                ? 'Informe a linha digitável do boleto'
                : 'Informe a chave PIX ou o QR Code copia e cola'
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-blue-600"
          />
        </div>
      </div>
    </Modal>
  )
}

function ModalNfTi({ solicitacao, aoFechar, aoConcluir }: PropsModalAcao) {
  const toaster = useToaster()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erroArquivo, setErroArquivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const selecionado = evento.target.files?.[0] ?? null
    evento.target.value = ''
    if (!selecionado) {
      setArquivo(null)
      setErroArquivo('')
      return
    }
    const extensao = selecionado.name.split('.').pop()?.toLowerCase() ?? ''
    if (!EXTENSOES_NF.includes(extensao)) {
      setArquivo(null)
      setErroArquivo('Formato inválido. Envie um arquivo PDF, PNG, JPG ou JPEG.')
      return
    }
    if (selecionado.size > TAMANHO_MAXIMO_NF) {
      setArquivo(null)
      setErroArquivo('Arquivo muito grande. Envie um arquivo de até 10 MB.')
      return
    }
    setErroArquivo('')
    setArquivo(selecionado)
  }

  async function anexarNotaFiscal() {
    if (!arquivo || enviando) return
    setEnviando(true)
    try {
      const corpo = new FormData()
      corpo.append('arquivo', arquivo)
      await apiUpload(`/solicitacoes/${solicitacao.id}/nf`, corpo)
      toaster.sucesso('Nota fiscal anexada — compra concluída')
      aoConcluir()
    } catch (erro) {
      toaster.erro(mensagemErro(erro, 'Não foi possível anexar a nota fiscal.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      aberto
      titulo="Anexar nota fiscal"
      aoFechar={aoFechar}
      acoes={
        <>
          <Button variante="secundario" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={anexarNotaFiscal} disabled={enviando || !arquivo}>
            {enviando ? 'Anexando…' : 'Anexar arquivo'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Envie a nota fiscal em PDF, PNG, JPG ou JPEG com até 10 MB. Após o anexo, a compra será
          concluída.
        </p>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`arquivo-nf-${solicitacao.id}`}
            className="text-sm font-medium text-slate-700"
          >
            Arquivo da nota fiscal
          </label>
          <input
            id={`arquivo-nf-${solicitacao.id}`}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={aoSelecionarArquivo}
            className="text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        {erroArquivo ? <p className="text-xs text-red-600">{erroArquivo}</p> : null}
        {arquivo ? (
          <p className="text-xs text-slate-500" data-testid={`arquivo-selecionado-${solicitacao.id}`}>
            Selecionado: {arquivo.name}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

interface PropsPainelTi {
  solicitacao: SolicitacaoResumo
  aoAcaoConcluida?: () => void
}

export function PainelTi({ solicitacao, aoAcaoConcluida }: PropsPainelTi) {
  const acao = acaoTiParaStatus(solicitacao.status)
  const [aberto, setAberto] = useState(false)

  if (acao === null) return null

  const aoFechar = () => setAberto(false)

  const aoConcluir = () => {
    setAberto(false)
    aoAcaoConcluida?.()
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => setAberto(true)}>{ROTULOS_ACAO_TI[acao]}</Button>
      {aberto && acao === 'COMPRAR' ? (
        <ModalCompraTi solicitacao={solicitacao} aoFechar={aoFechar} aoConcluir={aoConcluir} />
      ) : null}
      {aberto && acao === 'PAGAMENTO' ? (
        <ModalPagamentoTi solicitacao={solicitacao} aoFechar={aoFechar} aoConcluir={aoConcluir} />
      ) : null}
      {aberto && acao === 'NF' ? (
        <ModalNfTi solicitacao={solicitacao} aoFechar={aoFechar} aoConcluir={aoConcluir} />
      ) : null}
    </div>
  )
}
