import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { AppLayout } from './layouts/AppLayout'
import { Skeleton } from './components/ui/Skeleton'
import type { Perfil } from './types/api'

const LoginPage = lazy(() => import('./pages/login/LoginPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const SolicitacoesListPage = lazy(() => import('./pages/solicitacoes/SolicitacoesListPage'))
const SolicitacaoDetailPage = lazy(() => import('./pages/solicitacoes/SolicitacaoDetailPage'))
const NovaSolicitacaoPage = lazy(() => import('./pages/solicitacoes/NovaSolicitacaoPage'))
const AprovacoesPage = lazy(() => import('./pages/aprovacoes/AprovacoesPage'))
const ComprasPage = lazy(() => import('./pages/ti/ComprasPage'))
const PagamentosPage = lazy(() => import('./pages/pagamentos/PagamentosPage'))
const UsuariosPage = lazy(() => import('./pages/admin/UsuariosPage'))
const SetoresPage = lazy(() => import('./pages/admin/SetoresPage'))
const AuditoriaPage = lazy(() => import('./pages/admin/AuditoriaPage'))
const NotificacoesPage = lazy(() => import('./pages/notificacoes/NotificacoesPage'))

const TODOS_PERFIS: Perfil[] = [
  'SOLICITANTE',
  'GERENTE',
  'GERENTE_FINANCEIRA',
  'FINANCEIRO',
  'TI',
  'ADMINISTRADOR',
]
const PERFIS_FLUXO: Perfil[] = ['SOLICITANTE', 'GERENTE', 'GERENTE_FINANCEIRA', 'FINANCEIRO', 'TI']
const PERFIS_SOLICITANTE: Perfil[] = ['SOLICITANTE']
const PERFIS_APROVACAO: Perfil[] = ['GERENTE', 'GERENTE_FINANCEIRA']
const PERFIS_TI: Perfil[] = ['TI']
const PERFIS_PAGAMENTO: Perfil[] = ['GERENTE_FINANCEIRA', 'FINANCEIRO']
const PERFIS_ADMIN: Perfil[] = ['ADMINISTRADOR']

function FallbackCarregamento() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function RotaPublica({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  if (usuario) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function RotaProtegida({ perfis, children }: { perfis: Perfil[]; children: ReactNode }) {
  const { usuario } = useAuth()
  if (!usuario) {
    return <Navigate to="/login" replace />
  }
  if (!perfis.includes(usuario.perfil)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function LayoutAutenticado() {
  return (
    <RotaProtegida perfis={TODOS_PERFIS}>
      <AppLayout />
    </RotaProtegida>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FallbackCarregamento />}>
      <Routes>
        <Route
          path="/login"
          element={
            <RotaPublica>
              <LoginPage />
            </RotaPublica>
          }
        />
        <Route element={<LayoutAutenticado />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/solicitacoes"
            element={
              <RotaProtegida perfis={PERFIS_FLUXO}>
                <SolicitacoesListPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/solicitacoes/nova"
            element={
              <RotaProtegida perfis={PERFIS_SOLICITANTE}>
                <NovaSolicitacaoPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/solicitacoes/:id"
            element={
              <RotaProtegida perfis={PERFIS_FLUXO}>
                <SolicitacaoDetailPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/aprovacoes"
            element={
              <RotaProtegida perfis={PERFIS_APROVACAO}>
                <AprovacoesPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/ti"
            element={
              <RotaProtegida perfis={PERFIS_TI}>
                <ComprasPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/pagamentos"
            element={
              <RotaProtegida perfis={PERFIS_PAGAMENTO}>
                <PagamentosPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <RotaProtegida perfis={PERFIS_ADMIN}>
                <UsuariosPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/admin/setores"
            element={
              <RotaProtegida perfis={PERFIS_ADMIN}>
                <SetoresPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/admin/auditoria"
            element={
              <RotaProtegida perfis={PERFIS_ADMIN}>
                <AuditoriaPage />
              </RotaProtegida>
            }
          />
          <Route path="/notificacoes" element={<NotificacoesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
