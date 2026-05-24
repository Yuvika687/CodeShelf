import { Brain, Flame, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Topbar() {
  const { user } = useAuth()
  return (
    <header className="topbar">
      <div className="topbar-search"><Search size={16} /><input type="text" placeholder="Search your coding memory..." /><kbd>Ctrl K</kbd></div>
      <div className="topbar-actions">
        <Link to="/revision/today" className="topbar-upload"><Brain size={16} /> Revise</Link>
        <div className="topbar-streak" title={`Streak: ${user?.current_streak || 0} days`}><Flame size={20} /><span>{user?.current_streak || 0}</span></div>
        <Link to="/profile" className="topbar-profile"><div className="avatar sm">{user?.name?.charAt(0) || 'C'}</div><div><strong>{user?.name || 'CodeShelf'}</strong><small>Revision system</small></div></Link>
      </div>
    </header>
  )
}
