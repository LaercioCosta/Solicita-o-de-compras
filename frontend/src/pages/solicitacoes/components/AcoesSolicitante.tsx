import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../../api/client'
import { useAuth } from '../../../auth/AuthContext'
import { Button } from '../../../components/ui/Button'
import { Card, CardTitulo } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { useToaster } from '../../../components/ui/ToasterContext'
import { formatarCnpj, formatarMoeda } from '../../../lib/format'
import type { Orcamento, SolicitacaoDetalhe } from '../../../types/api'
import { CampoTextarea } from './CampoTextarea'
import { FormOrcamento } from './FormOrcamento'
import { FormSolicitacao } from './FormSolicitacao'
import {
  valoresIniciaisDoOrcamento,
  type PayloadOrcamento,
  type PayloadSolicitacao,
} from './formularioUtils'
import {
  STATUS_EDICAO_LIVRE,
  STATUS_PRE_COMPRA,
  eDonoSolicitante,
} from './regrasSolicitante'

const LIMITE_ORCAMENTOS = 3
const LIMITE_MOTIVO = 1000

interface PropsAcoesSolicitante {
  solicitacao: SolicitacaoDetalhe
  onAtualizar?: (solicitacao?: SolicitacaoDetalhe) => void
}

export function AcoesSolicitante({ solicitacao, onAtualizar }: PropsAcoesSolicitante) {
  const { usuario } = useAuth()
  const toaster = useToaster()
  const navigate = useNavigate()
  const [edicaoAberta, setEdicaoAberta] = useState<null | 'livre' | 'alteracao'>(null)
  const [orcamentoAberto, setOrcamentoAberto] = useState<null | { orcamento?: Orcamento }>(null)
  const [submissaoAberta, setSubmissaoAberta] = useState(false)
  const [cancelamentoAberto, setCancelamentoAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const dono = eDonoSolicitante(usuario, solicitacao)
  const edicaoLivre = STATUS_EDICAO_LIVRE.includes(solicitacao.status)
  const preCompra = STATUS_PRE_COMPRA.includes(solicitacao.status)
  const orcamentos = solicitacao.orcamentos
  const podeAdicionarOrcamento = orcamentos.length < LIMITE_ORCAMENTOS
  const podeSubmeter = orcamentos.length >= LIMITE_ORCAMENTOS

  if (!dono) return null

  async function enviarAcao(acao: () => Promise<void>): Promise<void> {
    setEnviando(true)
    try {
      await acao()
    } catch (erro) {
      const mensagem =
        erro instanceof ApiError ? erro.message : 'Erro inesperado. Tente novamente.'
      toaster.erro(mensagem)
    } finally {
      setEnviando(false)
    }
  }

  function abrirEdicao(modo: 'livre' | 'alteracao'): void {
    setEdicaoAberta(modo)
  }

  function salvarEdicao(payload: PayloadSolicitacao): void {
    void enviarAcao(async () => {
      const atualizada = await api<SolicitacaoDetalhe>(`/solicitacoes/${solicitacao.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (
        edicaoAberta === 'alteracao' &&
        atualizada.status === 'AGUARDANDO_APROVACAO_SETOR' &&
        atualizada.cicloAprovacao > solicitacao.cicloAprovacao
      ) {
        toaster.sucesso('Alteração enviada para nova aprovação.')
      } else {
        toaster.sucesso('Solicitação atualizada.')
      }
      setEdicaoAberta(null)
      onAtualizar?.(atualizada)
    })
  }

  function salvarOrcamento(payload: PayloadOrcamento): void {
    void enviarAcao(async () => {
      const alvo = orcamentoAberto?.orcamento
      if (alvo) {
        await api(`/solicitacoes/${solicitacao.id}/orcamentos/${alvo.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        toaster.sucesso('Orçamento atualizado.')
      } else {
        await api(`/solicitacoes/${solicitacao.id}/orcamentos`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toaster.sucesso('Orçamento adicionado.')
      }
      setOrcamentoAberto(null)
      onAtualizar?.()
    })
  }

  function confirmarSubmissao(): void {
    void enviarAcao(async () => {
      await api(`/solicitacoes/${solicitacao.id}/submeter`, { method: 'POST' })
      toaster.sucesso('Solicitação enviada para aprovação.')
      setSubmissaoAberta(false)
      onAtualizar?.()
    })
  }

  function abrirCancelamento(): void {
    setMotivo('')
    setErroMotivo('')
    setCancelamentoAberto(true)
  }

  function confirmarCancelamento(): void {
    const motivoLimpo = motivo.trim()
    if (!motivoLimpo) {
      setErroMotivo('Informe o motivo do cancelamento.')
      return
    }
    if (motivoLimpo.length > LIMITE_MOTIVO) {
      setErroMotivo('O motivo deve ter no máximo 1000 caracteres.')
      return
    }
    void enviarAcao(async () => {
      await api(`/solicitacoes/${solicitacao.id}/cancelar`, {
        method: 'POST',
        body: JSON.stringify({ motivo: motivoLimpo }),
      })
      toaster.sucesso('Solicitação cancelada.')
      setCancelamentoAberto(false)
      onAtualizar?.()
      navigate('/solicitacoes')
    })
  }

  const itensIniciais = solicitacao.itens.map((item) => ({
    chave: item.id,
    produto: item.produto,
    quantidade: String(item.quantidade),
    valorUnitario: String(item.valorUnitarioEstimado),
  }))

  return (
    <Card className="p-4">
      <CardTitulo>Ações do solicitante</CardTitulo>
      {edicaoLivre ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => abrirEdicao('livre')}>Editar</Button>
            <span title={podeAdicionarOrcamento ? undefined : 'Limite de 3 orçamentos atingido.'}>
              <Button
                variante="secundario"
                disabled={!podeAdicionarOrcamento}
                onClick={() => setOrcamentoAberto({})}
              >
                Adicionar orçamento ({orcamentos.length}/{LIMITE_ORCAMENTOS})
              </Button>
            </span>
            {podeSubmeter ? (
              <Button variante="secundario" onClick={() => setSubmissaoAberta(true)}>
                Submeter
              </Button>
            ) : (
              <span title="exige 3 orçamentos">
                <Button variante="secundario" disabled>
                  Submeter
                </Button>
              </span>
            )}
            <Button variante="perigo" onClick={abrirCancelamento}>
              Cancelar
            </Button>
          </div>
          {orcamentos.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {orcamentos.map((orcamento) => (
                <li
                  key={orcamento.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatarMoeda(orcamento.valor)}
                    </p>
                    <p className="text-xs text-slate-500">
                      CNPJ: {formatarCnpj(orcamento.cnpjLoja)}
                    </p>
                  </div>
                  <Button
                    variante="fantasma"
                    onClick={() => setOrcamentoAberto({ orcamento })}
                  >
                    Editar orçamento
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {preCompra ? (
        <div className="mt-3">
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Atenção: qualquer alteração reabre o ciclo de aprovação (DEC-015/DEC-027).
          </p>
          <div className="mt-3">
            <Button onClick={() => abrirEdicao('alteracao')}>Solicitar alteração</Button>
          </div>
        </div>
      ) : null}
      {!edicaoLivre && !preCompra ? (
        <p className="mt-2 text-sm text-slate-500">
          Solicitação bloqueada para edição (DEC-027).
        </p>
      ) : null}

      <Modal
        aberto={edicaoAberta !== null}
        titulo={edicaoAberta === 'alteracao' ? 'Solicitar alteração' : 'Editar solicitação'}
        aoFechar={() => setEdicaoAberta(null)}
      >
        <FormSolicitacao
          descricaoInicial={solicitacao.descricao}
          itensIniciais={itensIniciais}
          textoBotao="Salvar alterações"
          textoCancelar="Descartar alterações"
          enviando={enviando}
          aviso={
            edicaoAberta === 'alteracao'
              ? 'Ao salvar, a solicitação voltará para aprovação do setor e abrirá um novo ciclo de aprovação.'
              : undefined
          }
          onEnviar={salvarEdicao}
          onCancelar={() => setEdicaoAberta(null)}
        />
      </Modal>

      <Modal
        aberto={orcamentoAberto !== null}
        titulo={orcamentoAberto?.orcamento ? 'Editar orçamento' : 'Adicionar orçamento'}
        aoFechar={() => setOrcamentoAberto(null)}
      >
        <FormOrcamento
          key={orcamentoAberto?.orcamento?.id ?? 'novo-orcamento'}
          valoresIniciais={
            orcamentoAberto?.orcamento
              ? valoresIniciaisDoOrcamento(orcamentoAberto.orcamento)
              : undefined
          }
          textoBotao={orcamentoAberto?.orcamento ? 'Salvar orçamento' : 'Adicionar orçamento'}
          enviando={enviando}
          onEnviar={salvarOrcamento}
          onCancelar={() => setOrcamentoAberto(null)}
        />
      </Modal>

      <Modal
        aberto={submissaoAberta}
        titulo="Submeter para aprovação"
        aoFechar={() => setSubmissaoAberta(false)}
        acoes={
          <>
            <Button variante="fantasma" onClick={() => setSubmissaoAberta(false)} disabled={enviando}>
              Voltar
            </Button>
            <Button onClick={confirmarSubmissao} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Confirmar'}
            </Button>
          </>
        }
      >
        <p>Enviar esta solicitação para aprovação do setor?</p>
        <p className="mt-1 text-xs text-slate-500">O fluxo de aprovação será iniciado.</p>
      </Modal>

      <Modal
        aberto={cancelamentoAberto}
        titulo="Cancelar solicitação"
        aoFechar={() => setCancelamentoAberto(false)}
        acoes={
          <>
            <Button variante="fantasma" onClick={() => setCancelamentoAberto(false)} disabled={enviando}>
              Voltar
            </Button>
            <Button variante="perigo" onClick={confirmarCancelamento} disabled={enviando}>
              {enviando ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </>
        }
      >
        <CampoTextarea
          id="motivo-cancelamento"
          label="Motivo do cancelamento"
          valor={motivo}
          aoAlterar={(evento) => setMotivo(evento.target.value)}
          erro={erroMotivo}
          limite={LIMITE_MOTIVO}
        />
      </Modal>
    </Card>
  )
}
