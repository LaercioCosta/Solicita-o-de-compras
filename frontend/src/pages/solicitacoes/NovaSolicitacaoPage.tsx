import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToaster } from '../../components/ui/ToasterContext'
import type { SolicitacaoDetalhe } from '../../types/api'
import { FormSolicitacao } from './components/FormSolicitacao'
import type { PayloadSolicitacao } from './components/formularioUtils'

export default function NovaSolicitacaoPage() {
  const toaster = useToaster()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [erroApi, setErroApi] = useState('')

  async function criar(payload: PayloadSolicitacao): Promise<void> {
    setEnviando(true)
    setErroApi('')
    try {
      const criada = await api<SolicitacaoDetalhe>('/solicitacoes', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      toaster.sucesso('Solicitação criada com sucesso.')
      navigate(`/solicitacoes/${criada.id}`)
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 400) {
        setErroApi(erro.message)
      } else if (erro instanceof ApiError) {
        toaster.erro(erro.message)
      } else {
        toaster.erro('Erro inesperado. Tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Nova solicitação"
        descricao="Descreva a compra e informe os itens com quantidade e valor estimado."
      />
      <Card className="p-4 md:p-6">
        <FormSolicitacao
          textoBotao="Criar solicitação"
          enviando={enviando}
          erroApi={erroApi}
          onEnviar={(payload) => {
            void criar(payload)
          }}
        />
      </Card>
    </div>
  )
}
