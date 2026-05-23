import { Outlet } from 'react-router-dom'
import { Navigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Layout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className="auth-page"><p className="muted">Checking your session...</p></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <div className="layout">
      <Sidebar />
      <div className="layout-main">
        <Topbar />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
