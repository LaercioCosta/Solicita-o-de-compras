import type {
  CorpoErroApi,
  DocumentoBaixado,
  RespostaLogin,
  RespostaRefresh,
  Sessao,
} from '../types/api'

export const CHAVE_SESSAO = 'compras.session'
export const EVENTO_SESSAO_EXPIRADA = 'compras:sessao-expirada'

const BASE_URL = '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
  }
}

export function lerSessao(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    if (!bruto) return null
    return JSON.parse(bruto) as Sessao
  } catch {
    return null
  }
}

export function salvarSessao(sessao: Sessao): void {
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
}

export function limparSessao(): void {
  localStorage.removeItem(CHAVE_SESSAO)
}

async function erroDaResposta(resposta: Response): Promise<ApiError> {
  const padrao = new ApiError(resposta.status, 'Erro inesperado. Tente novamente.')
  try {
    const corpo = (await resposta.json()) as CorpoErroApi
    if (Array.isArray(corpo.message)) {
      return new ApiError(resposta.status, corpo.message.join(' '))
    }
    if (typeof corpo.message === 'string' && corpo.message.length > 0) {
      return new ApiError(resposta.status, corpo.message)
    }
    return padrao
  } catch {
    return padrao
  }
}

let promessaRefresh: Promise<boolean> | null = null

async function renovarTokens(): Promise<boolean> {
  if (promessaRefresh) return promessaRefresh
  promessaRefresh = (async () => {
    const sessao = lerSessao()
    if (!sessao?.refreshToken) return false
    try {
      const resposta = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: sessao.refreshToken }),
      })
      if (!resposta.ok) return false
      const dados = (await resposta.json()) as RespostaRefresh
      salvarSessao({ ...sessao, accessToken: dados.accessToken, refreshToken: dados.refreshToken })
      return true
    } catch {
      return false
    } finally {
      promessaRefresh = null
    }
  })()
  return promessaRefresh
}

function montarHeaders(opcoes: RequestInit): Headers {
  const headers = new Headers(opcoes.headers)
  const temCorpoJson = opcoes.body != null && !(opcoes.body instanceof FormData)
  if (temCorpoJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const sessao = lerSessao()
  if (sessao?.accessToken) {
    headers.set('Authorization', `Bearer ${sessao.accessToken}`)
  }
  return headers
}

async function executar(caminho: string, opcoes: RequestInit, permitirRefresh: boolean): Promise<Response> {
  const resposta = await fetch(`${BASE_URL}${caminho}`, { ...opcoes, headers: montarHeaders(opcoes) })
  if (resposta.status === 401 && permitirRefresh) {
    const renovou = await renovarTokens()
    if (renovou) {
      return executar(caminho, opcoes, false)
    }
    limparSessao()
    window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
    throw new ApiError(401, 'Sua sessão expirou. Faça login novamente.')
  }
  if (!resposta.ok) {
    throw await erroDaResposta(resposta)
  }
  return resposta
}

export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await executar(caminho, opcoes, true)
  if (resposta.status === 204) {
    return undefined as T
  }
  return (await resposta.json()) as T
}

export async function apiUpload<T>(caminho: string, dados: FormData): Promise<T> {
  return api<T>(caminho, { method: 'POST', body: dados })
}

function extrairNomeArquivo(disposition: string): string {
  const utf8 = /filename\*=(?:UTF-8|utf-8)''([^;]+)/.exec(disposition)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      return utf8[1]
    }
  }
  const simples = /filename="?([^";]+)"?/.exec(disposition)
  return simples ? simples[1] : 'arquivo'
}

export async function apiDownload(caminho: string): Promise<DocumentoBaixado> {
  const resposta = await executar(caminho, { method: 'GET' }, true)
  const disposition = resposta.headers.get('Content-Disposition') ?? ''
  const blob = await resposta.blob()
  return { blob, nomeArquivo: extrairNomeArquivo(disposition) }
}

export async function entrar(email: string, senha: string): Promise<RespostaLogin> {
  const resposta = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  if (!resposta.ok) {
    throw await erroDaResposta(resposta)
  }
  return (await resposta.json()) as RespostaLogin
}

export async function sair(): Promise<void> {
  const sessao = lerSessao()
  if (!sessao) return
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessao.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: sessao.refreshToken }),
    })
  } catch {
    return
  }
}
