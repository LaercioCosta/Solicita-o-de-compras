import { useState } from 'react'
import { ApiError, api } from '../../../api/client'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useToaster } from '../../../components/ui/ToasterContext'
import { formatarCnpj, formatarData, formatarDataHora, formatarMoeda } from '../../../lib/format'
import type { EstadoSolicitacao, ItemSolicitacao, SolicitacaoDetalhe } from '../../../types/api'

export type NivelAprovacao = 'SETOR' | 'FINANCEIRA'
export type DecisaoAprovacao = 'APROVADO' | 'REPROVADO'

const MENSAGEM_DECISAO_DUPLICADA = 'Decisão já registrada para este nível.'
const MENSAGEM_INDISPONIVEL = 'Solicitação não disponível para você.'
const LIMITE_MOTIVO = 1000

interface PropsPainelDecisao {
  solicitacao: SolicitacaoDetalhe
  nivel: NivelAprovacao
  aoConcluir: () => void
}

function calcularTotalItem(item: ItemSolicitacao): number {
  const valor =
    typeof item.valorUnitarioEstimado === 'string'
      ? Number.parseFloat(item.valorUnitarioEstimado)
      : item.valorUnitarioEstimado
  if (!Number.isFinite(valor)) return 0
  return item.quantidade * valor
}

export function PainelDecisao({ solicitacao, nivel, aoConcluir }: PropsPainelDecisao) {
  const toaster = useToaster()
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null)
  const [observacao, setObservacao] = useState('')
  const [enviando, setEnviando] = useState<DecisaoAprovacao | 'DEVOLUCAO' | null>(null)
  const [devolucaoAberta, setDevolucaoAberta] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState('')

  const totalEstimado = solicitacao.itens.reduce((acumulado, item) => acumulado + calcularTotalItem(item), 0)
  const decisaoBloqueada = orcamentoId === null || enviando !== null

  function tratarErro(erro: unknown, mensagemPadrao: string) {
    if (erro instanceof ApiError && erro.status === 409) {
      toaster.erro(MENSAGEM_DECISAO_DUPLICADA)
      aoConcluir()
      return
    }
    if (erro instanceof ApiError && erro.status === 404) {
      toaster.erro(MENSAGEM_INDISPONIVEL)
      aoConcluir()
      return
    }
    toaster.erro(erro instanceof ApiError && erro.message !== '' ? erro.message : mensagemPadrao)
  }

  async function decidir(decisao: DecisaoAprovacao) {
    if (decisaoBloqueada) return
    setEnviando(decisao)
    try {
      const corpo: Record<string, unknown> = { orcamentoId, decisao }
      if (observacao.trim() !== '') corpo.observacao = observacao.trim()
      await api<{ status: EstadoSolicitacao }>(`/solicitacoes/${solicitacao.id}/decisao`, {
        method: 'POST',
        body: JSON.stringify(corpo),
      })
      toaster.sucesso(decisao === 'APROVADO' ? 'Aprovada e registrada.' : 'Reprovada e registrada.')
      aoConcluir()
    } catch (erro) {
      tratarErro(erro, 'Não foi possível registrar a decisão.')
    } finally {
      setEnviando(null)
    }
  }

  async function confirmarDevolucao() {
    const texto = motivo.trim()
    if (texto.length < 1 || texto.length > LIMITE_MOTIVO) {
      setErroMotivo('Informe o motivo da devolução (1 a 1000 caracteres).')
      return
    }
    setEnviando('DEVOLUCAO')
    try {
      await api<{ status: EstadoSolicitacao }>(`/solicitacoes/${solicitacao.id}/devolver-correcao`, {
        method: 'POST',
        body: JSON.stringify({ motivo: texto }),
      })
      toaster.sucesso('Solicitação devolvida para correção.')
      setDevolucaoAberta(false)
      aoConcluir()
    } catch (erro) {
      tratarErro(erro, 'Não foi possível devolver a solicitação.')
    } finally {
      setEnviando(null)
    }
  }

  function abrirDevolucao() {
    setMotivo('')
    setErroMotivo('')
    setDevolucaoAberta(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">{solicitacao.descricao}</h3>
          <StatusBadge status={solicitacao.status} />
        </div>
        <p className="text-xs text-slate-500">
          Setor #{solicitacao.setorId} · Ciclo {solicitacao.cicloAprovacao} · Aberta em{' '}
          {formatarDataHora(solicitacao.createdAt)}
        </p>
      </section>

      <section aria-label="Itens da solicitação">
        <h4 className="text-sm font-semibold text-slate-900">Itens</h4>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Produto
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Qtd.
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Valor unitário estimado
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  Total estimado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {solicitacao.itens.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-slate-700">{item.produto}</td>
                  <td className="px-3 py-2 text-slate-700">{item.quantidade}</td>
                  <td className="px-3 py-2 text-slate-700">{formatarMoeda(item.valorUnitarioEstimado)}</td>
                  <td className="px-3 py-2 text-slate-700">{formatarMoeda(calcularTotalItem(item))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                  Total estimado
                </td>
                <td className="px-3 py-2 text-sm font-bold text-slate-900">{formatarMoeda(totalEstimado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section aria-label="Orçamentos da solicitação">
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-slate-900">Orçamentos</legend>
          <p className="mt-1 text-xs text-slate-500">
            A decisão precisa estar vinculada a um orçamento. Escolha um antes de aprovar ou reprovar.
          </p>
          {solicitacao.orcamentos.length === 0 ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset">
              Nenhum orçamento anexado a esta solicitação.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {solicitacao.orcamentos.map((orcamento) => {
                const selecionado = orcamentoId === orcamento.id
                return (
                  <li key={orcamento.id}>
                    <label
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 ring-1 transition ${
                        selecionado ? 'bg-blue-50 ring-blue-500' : 'bg-white ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`orcamento-${solicitacao.id}`}
                        checked={selecionado}
                        onChange={() => setOrcamentoId(orcamento.id)}
                        className="size-4 accent-blue-600"
                      />
                      <span className="text-lg font-bold text-emerald-700">{formatarMoeda(orcamento.valor)}</span>
                      <span className="text-xs text-slate-500">CNPJ {formatarCnpj(orcamento.cnpjLoja)}</span>
                      <span className="text-xs text-slate-500">Validade {formatarData(orcamento.validadeAte)}</span>
                      <a
                        href={orcamento.linkLoja}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Abrir loja
                      </a>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>
      </section>

      <div className="flex flex-col gap-1">
        <label htmlFor={`observacao-${solicitacao.id}`} className="text-sm font-medium text-slate-700">
          Observação (opcional)
        </label>
        <textarea
          id={`observacao-${solicitacao.id}`}
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
          rows={3}
          maxLength={LIMITE_MOTIVO}
          placeholder="Comentário enviado ao solicitante junto da decisão."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-blue-600"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {nivel === 'SETOR' ? (
          <Button variante="secundario" onClick={abrirDevolucao} disabled={enviando !== null}>
            Devolver para correção
          </Button>
        ) : null}
        <Button variante="perigo" disabled={decisaoBloqueada} onClick={() => decidir('REPROVADO')}>
          Reprovar
        </Button>
        <Button disabled={decisaoBloqueada} onClick={() => decidir('APROVADO')}>
          Aprovar
        </Button>
      </div>

      <Modal
        aberto={devolucaoAberta}
        titulo="Devolver para correção"
        aoFechar={() => setDevolucaoAberta(false)}
        acoes={
          <>
            <Button variante="fantasma" onClick={() => setDevolucaoAberta(false)} disabled={enviando !== null}>
              Cancelar
            </Button>
            <Button variante="perigo" onClick={confirmarDevolucao} disabled={enviando !== null}>
              Confirmar devolução
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          A solicitação voltará ao solicitante para ajustes. Descreva o que precisa ser corrigido.
        </p>
        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor={`motivo-${solicitacao.id}`} className="text-sm font-medium text-slate-700">
            Motivo da devolução
          </label>
          <textarea
            id={`motivo-${solicitacao.id}`}
            value={motivo}
            onChange={(evento) => {
              setMotivo(evento.target.value)
              setErroMotivo('')
            }}
            rows={3}
            maxLength={LIMITE_MOTIVO}
            aria-invalid={erroMotivo !== '' ? true : undefined}
            placeholder="Ex.: anexe o orçamento com valor atualizado."
            className={`rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 ${
              erroMotivo !== '' ? 'border-red-500' : 'border-slate-300'
            }`}
          />
          {erroMotivo !== '' ? <span className="text-xs text-red-600">{erroMotivo}</span> : null}
        </div>
      </Modal>
    </div>
  )
}
