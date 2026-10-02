import { useState, type ChangeEvent } from 'react'
import { ApiError, apiUpload } from '../../../api/client'
import { useAuth } from '../../../auth/AuthContext'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { useToaster } from '../../../components/ui/ToasterContext'
import type { Orcamento, SolicitacaoDetalhe } from '../../../types/api'
import {
  eDonoSolicitante,
  podeAnexarDocumentoOrcamento,
  reabreCicloAprovacao,
} from './regrasSolicitante'

const EXTENSOES_DOCUMENTO = ['pdf', 'png', 'jpg', 'jpeg']
const TAMANHO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024

interface PropsAnexoDocumentoOrcamento {
  solicitacao: SolicitacaoDetalhe
  orcamento: Orcamento
  onAtualizar: () => void
}

export function AnexoDocumentoOrcamento({
  solicitacao,
  orcamento,
  onAtualizar,
}: PropsAnexoDocumentoOrcamento) {
  const { usuario } = useAuth()
  const toaster = useToaster()
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erroArquivo, setErroArquivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!eDonoSolicitante(usuario, solicitacao)) return null
  if (!podeAnexarDocumentoOrcamento(solicitacao.status)) return null

  const reabreCiclo = reabreCicloAprovacao(solicitacao.status)

  function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>): void {
    const selecionado = evento.target.files?.[0] ?? null
    evento.target.value = ''
    if (!selecionado) {
      setArquivo(null)
      setErroArquivo('')
      return
    }
    const extensao = selecionado.name.split('.').pop()?.toLowerCase() ?? ''
    if (!EXTENSOES_DOCUMENTO.includes(extensao)) {
      setArquivo(null)
      setErroArquivo('Formato inválido. Envie um arquivo PDF, PNG, JPG ou JPEG.')
      return
    }
    if (selecionado.size > TAMANHO_MAXIMO_DOCUMENTO) {
      setArquivo(null)
      setErroArquivo('Arquivo muito grande. Envie um arquivo de até 10 MB.')
      return
    }
    setErroArquivo('')
    setArquivo(selecionado)
  }

  async function anexarDocumento(): Promise<void> {
    if (!arquivo || enviando) return
    setEnviando(true)
    try {
      const corpo = new FormData()
      corpo.append('arquivo', arquivo)
      await apiUpload(`/solicitacoes/${solicitacao.id}/orcamentos/${orcamento.id}/documento`, corpo)
      toaster.sucesso('Documento do orçamento anexado.')
      setAberto(false)
      onAtualizar()
    } catch (erro) {
      const mensagem = erro instanceof ApiError ? erro.message : 'Não foi possível anexar o documento.'
      toaster.erro(mensagem)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button variante="secundario" onClick={() => setAberto(true)}>
        Anexar PDF do orçamento
      </Button>
      <Modal
        aberto={aberto}
        titulo="Anexar PDF do orçamento"
        aoFechar={() => setAberto(false)}
        acoes={
          <>
            <Button variante="secundario" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={anexarDocumento} disabled={enviando || !arquivo}>
              {enviando ? 'Anexando...' : 'Anexar arquivo'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Envie o orçamento em PDF, PNG, JPG ou JPEG com até 10 MB.
          </p>
          {reabreCiclo ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              Atenção: isto reabre o ciclo de aprovação.
            </p>
          ) : null}
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`arquivo-orcamento-${orcamento.id}`}
              className="text-sm font-medium text-slate-700"
            >
              Arquivo do orçamento
            </label>
            <input
              id={`arquivo-orcamento-${orcamento.id}`}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={aoSelecionarArquivo}
              className="text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {erroArquivo ? <p className="text-xs text-red-600">{erroArquivo}</p> : null}
          {arquivo ? (
            <p className="text-xs text-slate-500" data-testid={`arquivo-selecionado-${orcamento.id}`}>
              Selecionado: {arquivo.name}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
