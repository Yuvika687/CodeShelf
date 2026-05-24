import { Code2, MailCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState('')

  async function handleGoogle() {
    setError('')
    try {
      await loginWithGoogle()
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AuthShell title="Enter your coding memory vault" subtitle="Create or continue with Google. Your verified Google email is where reminders and welcome emails go.">
      <button className="btn google-button full" onClick={handleGoogle} type="button">
        <span className="google-mark">G</span>
        Continue with Google
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      <p className="auth-footer">No password account required. Google verifies your inbox before CodeShelf sends reminders.</p>
    </AuthShell>
  )
}

export function AuthShell({ title, subtitle, children }) {
  const handleMove = (event) => {
    const mainEl = event.currentTarget
    const bounds = mainEl.getBoundingClientRect()
    const mx = ((event.clientX - bounds.left) / bounds.width) * 100
    const my = ((event.clientY - bounds.top) / bounds.height) * 100
    mainEl.style.setProperty('--mx', `${mx}%`)
    mainEl.style.setProperty('--my', `${my}%`)
  }

  return (
    <main
      className="auth-page luxury-auth"
      onPointerMove={handleMove}
      style={{ '--mx': `50%`, '--my': `50%` }}
    >
      <section className="auth-story">
        <div className="auth-ribbons" aria-hidden="true">
          <span>recall.card(topic="DSA", due=today)</span>
          <span>mistake.fix("edge case before interview")</span>
          <span>walk_mode.explain(summary)</span>
          <span>email.send(verified_google_user)</span>
        </div>
        <Link to="/" className="auth-logo auth-logo-left"><span><Code2 size={20} /></span> CodeShelf</Link>
        <div className="auth-story-copy">
          <p className="eyebrow">Verified revision system</p>
          <h1>Learn once. Keep it forever.</h1>
          <p>CodeShelf turns notes, mistakes, commands, and solved problems into spaced recall cards, travel packs, walk-mode explanations, and verified email reminders.</p>
        </div>
        <div className="auth-proof-grid">
          <div><Sparkles size={18} /><strong>AI summaries</strong><span>HF Space or Gemini fallback</span></div>
          <div><MailCheck size={18} /><strong>Verified reminders</strong><span>No fake inbox loops</span></div>
          <div><ShieldCheck size={18} /><strong>Private memory</strong><span>Your JWT-secured backend</span></div>
        </div>
      </section>
      <section className="auth-card premium-card">
        <div className="auth-card-scan" aria-hidden="true" />
        <div className="auth-card-heading">
          <p className="eyebrow">CodeShelf</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  )
}

