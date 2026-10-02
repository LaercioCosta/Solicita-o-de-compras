import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError, apiUpload } from '../../../api/client'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { useToaster } from '../../../components/ui/ToasterContext'
import { formatarData, formatarMoeda } from '../../../lib/format'
import type { EstadoSolicitacao, PagamentoInfo, RespostaPagamento } from '../../../types/api'
import { copiarTexto } from '../clipboard'

const EXTENSOES_ACEITAS = ['pdf', 'png', 'jpg', 'jpeg']
const TAMANHO_MAXIMO = 10 * 1024 * 1024
const REGEX_VALOR = /^\d+(?:[.,]\d{1,2})?$/

function validarValor(valor: string): string | null {
  const texto = valor.trim()
  if (texto === '') return 'Informe o valor pago.'
  if (!REGEX_VALOR.test(texto)) return 'Valor inválido. Use até 2 casas decimais (ex.: 1500.00).'
  if (Number.parseFloat(texto.replace(',', '.')) <= 0) return 'O valor deve ser maior que zero.'
  return null
}

function validarArquivo(arquivo: File | null): string | null {
  if (!arquivo) return 'Selecione o arquivo do comprovante.'
  const partes = arquivo.name.split('.')
  const extensao = partes.length > 1 ? (partes.pop() ?? '').toLowerCase() : ''
  if (!EXTENSOES_ACEITAS.includes(extensao)) return 'Formato inválido. Envie PDF, PNG, JPG ou JPEG.'
  if (arquivo.size > TAMANHO_MAXIMO) return 'O arquivo deve ter no máximo 10MB.'
  return null
}

function IconeBoleto() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-4 text-slate-500"
      aria-hidden="true"
    >
      <path d="M4 5v14M8 5v14M12 5v9M16 5v14M20 5v9" />
    </svg>
  )
}

function IconePix() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 text-slate-500"
      aria-hidden="true"
    >
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3M20 14v6h-6" />
    </svg>
  )
}

interface PropsPainelPagador {
  pagamento?: PagamentoInfo | null
  status: EstadoSolicitacao
  podePagar?: boolean
  onPago?: () => void
}

export function PainelPagador({ pagamento, status, podePagar = true, onPago }: PropsPainelPagador) {
  const toaster = useToaster()
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erroValor, setErroValor] = useState<string | null>(null)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const pago = status === 'PAGO' || pagamento?.pagoEm != null

  function abrirModal() {
    setValor('')
    setArquivo(null)
    setErroValor(null)
    setErroArquivo(null)
    setErroEnvio(null)
    setAberto(true)
  }

  function fecharModal() {
    setAberto(false)
  }

  function aoTrocarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    setArquivo(evento.target.files?.[0] ?? null)
    setErroArquivo(null)
  }

  async function aoCopiar() {
    if (!pagamento) return
    const ok = await copiarTexto(pagamento.dados)
    if (ok) {
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
      return
    }
    toaster.erro('Não foi possível copiar.')
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!pagamento) return
    const problemaValor = validarValor(valor)
    const problemaArquivo = validarArquivo(arquivo)
    setErroValor(problemaValor)
    setErroArquivo(problemaArquivo)
    setErroEnvio(null)
    if (problemaValor !== null || problemaArquivo !== null || !arquivo) return
    setEnviando(true)
    try {
      const dados = new FormData()
      dados.append('valorPago', valor.trim().replace(',', '.'))
      dados.append('arquivo', arquivo)
      await apiUpload<RespostaPagamento>(`/pagamentos/${pagamento.id}/pagar`, dados)
      toaster.sucesso('Pagamento registrado')
      fecharModal()
      onPago?.()
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 409) {
        toaster.erro('Pagamento já executado')
        fecharModal()
        onPago?.()
        return
      }
      if (erro instanceof ApiError) {
        setErroEnvio(erro.message)
        return
      }
      setErroEnvio('Erro inesperado. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {pago ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tom="verde">Pago</Badge>
          <span className="text-sm text-slate-600">
            {pagamento?.pagoEm != null ? `Pago em ${formatarData(pagamento.pagoEm)}` : 'Pagamento já efetuado'}
          </span>
          {pagamento?.valorPago != null ? (
            <span className="text-sm font-medium text-slate-700">{formatarMoeda(pagamento.valorPago)}</span>
          ) : null}
        </div>
      ) : pagamento ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              {pagamento.forma === 'BOLETO' ? <IconeBoleto /> : <IconePix />}
              {pagamento.forma === 'BOLETO' ? 'Boleto' : 'PIX'}
            </span>
            {podePagar ? (
              <Button variante="primario" onClick={abrirModal}>
                Registrar pagamento
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ring-1 ring-slate-200">
              {pagamento.dados}
            </code>
            <Button variante="secundario" onClick={aoCopiar}>
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Pagamento não disponível</p>
      )}
      <Modal aberto={aberto} titulo="Registrar pagamento" aoFechar={fecharModal}>
        <form className="flex flex-col gap-4" onSubmit={aoEnviar} noValidate>
          <Input
            label="Valor pago (R$)"
            id={`valor-pago-${pagamento?.id ?? 'atual'}`}
            inputMode="decimal"
            placeholder="1500.00"
            value={valor}
            onChange={(evento) => {
              setValor(evento.target.value)
              setErroValor(null)
            }}
            erro={erroValor ?? undefined}
            disabled={enviando}
          />
          <div className="flex flex-col gap-1">
            <Input
              label="Comprovante"
              id={`comprovante-${pagamento?.id ?? 'atual'}`}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={aoTrocarArquivo}
              erro={erroArquivo ?? undefined}
              disabled={enviando}
            />
            <p className="text-xs text-slate-500">PDF, PNG, JPG ou JPEG de até 10MB.</p>
          </div>
          {erroEnvio != null ? (
            <p role="alert" className="text-sm text-red-600">
              {erroEnvio}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variante="secundario" onClick={fecharModal} disabled={enviando}>
              Cancelar
            </Button>
            <Button variante="primario" type="submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Registrar pagamento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
