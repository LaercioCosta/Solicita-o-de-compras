async function copiarViaElemento(texto: string): Promise<boolean> {
  let area: HTMLTextAreaElement | null = null
  try {
    area = document.createElement('textarea')
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area?.remove()
  }
}

export async function copiarTexto(texto: string): Promise<boolean> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      return copiarViaElemento(texto)
    }
  }
  return copiarViaElemento(texto)
}
