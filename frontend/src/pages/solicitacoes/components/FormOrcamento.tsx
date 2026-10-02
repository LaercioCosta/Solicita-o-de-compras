import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import {
  mascararCnpj,
  type PayloadOrcamento,
  type ValoresOrcamento,
} from './formularioUtils'

interface ErrosOrcamento {
  linkLoja?: string
  cnpjLoja?: string
  valor?: string
}

function validarLinkLoja(valor: string): string | undefined {
  const limpo = valor.trim()
  if (!limpo) return 'Informe o link da loja.'
  try {
    const url = new URL(limpo)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'O link deve ser uma URL http ou https válida.'
    }
    return undefined
  } catch {
    return 'O link deve ser uma URL http ou https válida.'
  }
}

function validarCnpj(valor: string): string | undefined {
  if (valor.replace(/\D/g, '').length !== 14) return 'O CNPJ deve ter 14 dígitos.'
  return undefined
}

function validarValor(valor: string): string | undefined {
  const limpo = valor.trim()
  if (!limpo) return 'Informe o valor do orçamento.'
  if (!/^\d+([.,]\d{1,2})?$/.test(limpo)) return 'O valor deve ser maior que zero.'
  const numero = Number(limpo.replace(',', '.'))
  if (!Number.isFinite(numero) || numero <= 0) return 'O valor deve ser maior que zero.'
  return undefined
}

interface PropsFormOrcamento {
  valoresIniciais?: ValoresOrcamento
  textoBotao: string
  enviando?: boolean
  onEnviar: (payload: PayloadOrcamento) => void
  onCancelar?: () => void
}

export function FormOrcamento({
  valoresIniciais,
  textoBotao,
  enviando = false,
  onEnviar,
  onCancelar,
}: PropsFormOrcamento) {
  const [linkLoja, setLinkLoja] = useState(valoresIniciais?.linkLoja ?? '')
  const [cnpjLoja, setCnpjLoja] = useState(valoresIniciais?.cnpjLoja ?? '')
  const [valor, setValor] = useState(valoresIniciais?.valor ?? '')
  const [validadeAte, setValidadeAte] = useState(valoresIniciais?.validadeAte ?? '')
  const [erros, setErros] = useState<ErrosOrcamento>({})

  function aoSubmeter(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    const novosErros: ErrosOrcamento = {
      linkLoja: validarLinkLoja(linkLoja),
      cnpjLoja: validarCnpj(cnpjLoja),
      valor: validarValor(valor),
    }
    if (Object.values(novosErros).some(Boolean)) {
      setErros(novosErros)
      return
    }
    setErros({})
    const payload: PayloadOrcamento = {
      linkLoja: linkLoja.trim(),
      cnpjLoja: cnpjLoja.replace(/\D/g, ''),
      valor: Number(valor.trim().replace(',', '.')),
    }
    const validade = validadeAte.trim()
    if (validade) payload.validadeAte = validade
    onEnviar(payload)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={aoSubmeter} noValidate>
      <Input
        id="link-loja"
        label="Link da loja"
        type="text"
        placeholder="https://www.loja.com.br/produto"
        value={linkLoja}
        onChange={(evento) => setLinkLoja(evento.target.value)}
        erro={erros.linkLoja}
      />
      <Input
        id="cnpj-loja"
        label="CNPJ da loja"
        type="text"
        inputMode="numeric"
        placeholder="00.000.000/0000-00"
        value={cnpjLoja}
        onChange={(evento) => setCnpjLoja(mascararCnpj(evento.target.value))}
        erro={erros.cnpjLoja}
      />
      <div className="flex flex-wrap gap-4">
        <div className="min-w-36 flex-1">
          <Input
            id="valor-orcamento"
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
            erro={erros.valor}
          />
        </div>
        <div className="min-w-36 flex-1">
          <Input
            id="validade-orcamento"
            label="Validade (opcional)"
            type="date"
            value={validadeAte}
            onChange={(evento) => setValidadeAte(evento.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <Button variante="secundario" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Salvando...' : textoBotao}
        </Button>
      </div>
    </form>
  )
}
