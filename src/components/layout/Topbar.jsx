import { Brain, Flame, Search, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Topbar() {
  const { user } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem('codeshelf_theme') || 'dark')

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme')
    } else {
      document.body.classList.remove('light-theme')
    }
    localStorage.setItem('codeshelf_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={16} />
        <input type="text" placeholder="Search your coding memory..." />
        <kbd>Ctrl K</kbd>
      </div>
      <div className="topbar-actions">
        <button 
          onClick={toggleTheme} 
          className="theme-switch clickable" 
          aria-label="Toggle visual theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/revision/today" className="topbar-upload clickable"><Brain size={16} /> Revise</Link>
        <div className="topbar-streak" title={`Streak: ${user?.current_streak || 0} days`}>
          <Flame size={20} />
          <span>{user?.current_streak || 0}</span>
        </div>
        <Link to="/profile" className="topbar-profile clickable">
          <div className="avatar sm">{user?.name?.charAt(0) || 'C'}</div>
          <div>
            <strong>{user?.name || 'CodeShelf'}</strong>
            <small>Revision system</small>
          </div>
        </Link>
      </div>
    </header>
  )
}

