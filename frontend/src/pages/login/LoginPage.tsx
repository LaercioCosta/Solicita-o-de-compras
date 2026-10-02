import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

interface ErrosFormulario {
  email?: string
  senha?: string
}

export default function LoginPage() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erros, setErros] = useState<ErrosFormulario>({})
  const [erroApi, setErroApi] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (usuario) {
    return <Navigate to="/" replace />
  }

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const novosErros: ErrosFormulario = {}
    if (!email.trim()) novosErros.email = 'Informe o e-mail'
    if (!senha) novosErros.senha = 'Informe a senha'
    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros)
      return
    }
    setErros({})
    setErroApi('')
    setEnviando(true)
    try {
      await login(email, senha)
      navigate('/', { replace: true })
    } catch (erro) {
      if (erro instanceof ApiError) {
        setErroApi(erro.status === 401 ? 'E-mail ou senha inválidos.' : erro.message)
      } else {
        setErroApi('Não foi possível entrar. Tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Sistema de Compras</h1>
        <p className="mt-1 text-sm text-slate-500">Entre com suas credenciais para acessar</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={aoSubmeter} noValidate>
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            erro={erros.email}
          />
          <Input
            label="Senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            erro={erros.senha}
          />
          {erroApi ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {erroApi}
            </p>
          ) : null}
          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
