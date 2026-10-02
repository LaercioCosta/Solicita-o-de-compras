import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ToasterProvider } from './components/ui/Toaster'
import { AppRoutes } from './router'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToasterProvider>
          <AppRoutes />
        </ToasterProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
