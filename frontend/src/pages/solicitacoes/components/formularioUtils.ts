import type { Orcamento } from '../../../types/api'

export interface ItemFormulario {
  chave: string
  produto: string
  quantidade: string
  valorUnitario: string
}

export interface ItemPayload {
  produto: string
  quantidade: number
  valorUnitarioEstimado: number
}

export interface PayloadSolicitacao {
  descricao: string
  itens: ItemPayload[]
}

export interface PayloadOrcamento {
  linkLoja: string
  cnpjLoja: string
  valor: number
  validadeAte?: string
}

export interface ValoresOrcamento {
  linkLoja: string
  cnpjLoja: string
  valor: string
  validadeAte: string
}

let proximaChave = 1

export function novoItemFormulario(): ItemFormulario {
  const chave = `item-${proximaChave}`
  proximaChave += 1
  return { chave, produto: '', quantidade: '', valorUnitario: '' }
}

export function mascararCnpj(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 14)
  let saida = digitos.slice(0, 2)
  if (digitos.length > 2) saida += `.${digitos.slice(2, 5)}`
  if (digitos.length > 5) saida += `.${digitos.slice(5, 8)}`
  if (digitos.length > 8) saida += `/${digitos.slice(8, 12)}`
  if (digitos.length > 12) saida += `-${digitos.slice(12)}`
  return saida
}

export function valoresIniciaisDoOrcamento(orcamento: Orcamento): ValoresOrcamento {
  return {
    linkLoja: orcamento.linkLoja,
    cnpjLoja: mascararCnpj(orcamento.cnpjLoja),
    valor: String(orcamento.valor),
    validadeAte: orcamento.validadeAte ? orcamento.validadeAte.slice(0, 10) : '',
  }
}

export function paraNumeroDecimal(valor: string): number {
  return Number(valor.trim().replace(',', '.'))
}
