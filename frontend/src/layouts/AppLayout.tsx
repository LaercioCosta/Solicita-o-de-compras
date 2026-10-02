import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ROTULOS_PERFIL, itensNavPara, type ItemNav } from '../auth/capacidades'
import type { Notificacao } from '../types/api'
import { NotificacoesContext, type ValorNotificacoes } from './NotificacoesContext'

function ItemLinkNav({ item, aoNavegar, naoLidas }: { item: ItemNav; aoNavegar: () => void; naoLidas: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={aoNavegar}
      className={({ isActive }) =>
        `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      <span>{item.rotulo}</span>
      {item.comBadge && naoLidas > 0 ? (
        <span
          data-testid="badge-notificacoes"
          className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
        >
          {naoLidas}
        </span>
      ) : null}
    </NavLink>
  )
}

function ListaNav({ itens, aoNavegar, naoLidas }: { itens: ItemNav[]; aoNavegar: () => void; naoLidas: number }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3">
      {itens.map((item) => (
        <ItemLinkNav key={item.to} item={item} aoNavegar={aoNavegar} naoLidas={naoLidas} />
      ))}
    </nav>
  )
}

function PainelUsuario() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  if (!usuario) return null
  return (
    <div className="border-t border-slate-200 p-4">
      <p className="truncate text-sm font-semibold text-slate-900">{usuario.nome}</p>
      <p className="text-xs text-slate-500">{ROTULOS_PERFIL[usuario.perfil]}</p>
      <button
        type="button"
        onClick={() => {
          logout()
          navigate('/login')
        }}
        className="mt-3 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        Sair
      </button>
    </div>
  )
}

export function AppLayout() {
  const { usuario } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [naoLidas, setNaoLidas] = useState(0)

  const atualizarNaoLidas = useCallback(() => {
    api<Notificacao[]>('/notificacoes')
      .then((lista) => setNaoLidas(lista.filter((notificacao) => !notificacao.lida).length))
      .catch(() => setNaoLidas(0))
  }, [])

  useEffect(() => {
    atualizarNaoLidas()
  }, [atualizarNaoLidas])

  const valorNotificacoes = useMemo<ValorNotificacoes>(
    () => ({ naoLidas, atualizar: atualizarNaoLidas }),
    [naoLidas, atualizarNaoLidas],
  )

  const itensNav = useMemo(() => (usuario ? itensNavPara(usuario.perfil) : []), [usuario])

  if (!usuario) return null

  const fecharMenu = () => setMenuAberto(false)

  return (
    <NotificacoesContext.Provider value={valorNotificacoes}>
      <div className="flex min-h-screen bg-slate-100">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="border-b border-slate-200 p-4">
            <p className="text-lg font-bold text-slate-900">Sistema de Compras</p>
          </div>
          <ListaNav itens={itensNav} aoNavegar={fecharMenu} naoLidas={naoLidas} />
          <PainelUsuario />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
            <p className="text-base font-bold text-slate-900">Sistema de Compras</p>
            <button
              type="button"
              aria-expanded={menuAberto}
              aria-controls="menu-mobile"
              onClick={() => setMenuAberto((aberto) => !aberto)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            >
              <span className="sr-only">Abrir menu</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </header>

          {menuAberto ? (
            <div id="menu-mobile" className="flex flex-col border-b border-slate-200 bg-white md:hidden">
              <div className="flex flex-col py-2">
                <ListaNav itens={itensNav} aoNavegar={fecharMenu} naoLidas={naoLidas} />
                <PainelUsuario />
              </div>
            </div>
          ) : null}

          <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificacoesContext.Provider>
  )
}
