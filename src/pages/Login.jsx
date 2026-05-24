import { Code2, MailCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      navigate('/')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell 
      title="Access Memory Vault" 
      subtitle="Continue secure sync via your Google account credentials."
    >
      <div className="login-action-area">
        <button 
          className={`btn google-button full clickable ${loading ? 'syncing' : ''}`} 
          onClick={handleGoogle} 
          type="button"
          disabled={loading}
        >
          <span className="google-mark">G</span>
          {loading ? 'Decrypting Vault...' : 'Authenticate with Google'}
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
      <p className="auth-footer">
        CodeShelf processes credentials directly. Safe vault keys are generated dynamically.
      </p>
    </AuthShell>
  )
}

export function AuthShell({ title, subtitle, children }) {
  const [motion, setMotion] = useState({ x: 50, y: 50 })
  const handleMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setMotion({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    })
  }

  return (
    <main
      className="auth-page luxury-auth"
      onPointerMove={handleMove}
      style={{ '--mx': `${motion.x}%`, '--my': `${motion.y}%` }}
    >
      <section className="auth-story">
        <div className="auth-ribbons" aria-hidden="true">
          <span>recall.card(topic="DSA", due=today)</span>
          <span>mistake.fix("edge case before interview")</span>
          <span>walk_mode.explain(summary)</span>
          <span>email.send(verified_google_user)</span>
        </div>
        <div className="auth-logo auth-logo-left">
          <span className="sidebar-logo-icon"><Code2 size={20} /></span> 
          <span>CodeShelf</span>
        </div>
        <div className="auth-story-copy">
          <p className="eyebrow">CODESHELF MEMORY SYSTEM</p>
          <h1>Learn once.<br/>Remember forever.</h1>
          <p>CodeShelf turns notes, mistakes, commands, and solved problems into spaced recall cards, travel packs, walk-mode explanations, and verified email reminders.</p>
        </div>
        <div className="auth-proof-grid">
          <div className="card clickable">
            <Sparkles size={18} color="#e5b95c" />
            <strong>AI Summarization</strong>
            <span>HF Space or Gemini fallback</span>
          </div>
          <div className="card clickable">
            <MailCheck size={18} color="#5eead4" />
            <strong>Verified reminders</strong>
            <span>Active inbox daily loops</span>
          </div>
          <div className="card clickable">
            <ShieldCheck size={18} color="#10b981" />
            <strong>Private memory</strong>
            <span>Your JWT-secured backend</span>
          </div>
        </div>
      </section>
      <section className="auth-card card">
        <div className="auth-card-heading">
          <p className="eyebrow">SECURE GATEWAY</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  )
}

