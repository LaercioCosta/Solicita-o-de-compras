export function formatarMoeda(valor: string | number): string {
  const numero = typeof valor === 'string' ? Number.parseFloat(valor) : valor
  if (!Number.isFinite(numero)) return 'R$ 0,00'
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatarCnpj(valor: string | null | undefined): string {
  if (!valor) return '—'
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length !== 14) return valor
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`
}
