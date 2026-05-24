import { NavLink } from 'react-router-dom'
import { BookOpen, Brain, BriefcaseBusiness, Cloud, Code2, Footprints, Home, LogOut, Mail, Plane, Plus, ShieldAlert, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

const mainLinks = [
  { name: 'Dashboard', icon: Home, path: '/' },
  { name: 'Today Revision', icon: Brain, path: '/revision/today' },
  { name: 'Walk Mode', icon: Footprints, path: '/walk-mode' },
  { name: 'Travel Mode', icon: Plane, path: '/travel-mode' },
  { name: 'Library', icon: BookOpen, path: '/library' },
  { name: 'Problems', icon: BriefcaseBusiness, path: '/problems' },
  { name: 'Mistake Book', icon: ShieldAlert, path: '/mistakes' },
  { name: 'Email Settings', icon: Mail, path: '/email-settings' },
]

const quickLinks = [
  { name: 'Add Note', icon: Plus, path: '/add-note' },
  { name: 'Profile', icon: User, path: '/profile' },
]

export default function Sidebar() {
  const { logout, user } = useAuth()
  return (
    <aside className="sidebar">
      <NavLink to="/" className="sidebar-logo"><div className="sidebar-logo-icon"><Code2 size={20} /></div><span>CodeShelf</span></NavLink>
      <nav className="sidebar-nav">
        <div className="sidebar-section">{mainLinks.map((link) => <NavItem key={link.name} {...link} />)}</div>
        <div className="sidebar-section"><p className="sidebar-section-title">Quick Actions</p>{quickLinks.map((link) => <NavItem key={link.name} {...link} />)}</div>
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-cta"><h3>Memory Loop</h3><p>Add learning, generate cards, revise daily, repeat weak topics.</p><NavLink to="/revision/today" className="sidebar-cta-btn">Start <Cloud size={14} /></NavLink></div>
      <div className="sidebar-account">
        <NavLink to="/profile" className="sidebar-user"><div className="avatar sm">{user?.name?.charAt(0) || 'C'}</div><span>{user?.name || 'Profile'}</span></NavLink>
        <NavItem name="Sign Out" icon={LogOut} path="/login" onClick={logout} />
      </div>
    </aside>
  )
}

function NavItem({ name, icon: Icon, path, onClick }) {
  return <NavLink to={path} onClick={onClick} end={path === '/'} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}><Icon size={16} /><span>{name}</span></NavLink>
}
