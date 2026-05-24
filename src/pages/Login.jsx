import { Code2, Fingerprint, MailCheck, ShieldCheck, Sparkles, Terminal, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
      navigate(location.state?.from || '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page" onPointerMove={handleMove} style={{ '--mx': '50%', '--my': '50%' }}>
      {/* Animated background grid */}
      <div className="login-grid-bg" aria-hidden="true" />
      <div className="login-orbs" aria-hidden="true">
        <span className="login-orb orb-1" />
        <span className="login-orb orb-2" />
        <span className="login-orb orb-3" />
      </div>

      {/* Left story panel */}
      <section className="login-story">
        <Link to="/" className="login-brand">
          <span className="login-brand-icon"><Code2 size={22} /></span>
          <span>CodeShelf</span>
        </Link>

        <div className="login-story-copy">
          <p className="eyebrow">Spaced Repetition for Developers</p>
          <h1>Learn once.<br />Keep it <em>forever</em>.</h1>
          <p>Transform notes, mistakes, and solved problems into an intelligent revision system with AI cards, walk-mode audio, and streak-powered email reminders.</p>
        </div>

        <div className="login-features">
          <div className="login-feature">
            <div className="login-feature-icon"><Sparkles size={18} /></div>
            <div><strong>AI Card Generation</strong><span>Auto-generate recall cards from your notes</span></div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon"><Terminal size={18} /></div>
            <div><strong>Walk Mode</strong><span>Audio revision while on the go</span></div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon"><Zap size={18} /></div>
            <div><strong>Smart Streaks</strong><span>Build consistency with daily review</span></div>
          </div>
        </div>

        <div className="login-ribbons" aria-hidden="true">
          <span>recall.card(topic="DSA", due=today)</span>
          <span>mistake.fix("edge case")</span>
          <span>walk_mode.explain(summary)</span>
        </div>
      </section>

      {/* Right card panel */}
      <section className="login-card">
        <div className="login-card-glow" aria-hidden="true" />
        <div className="login-card-inner">
          <div className="login-card-head">
            <div className="login-card-badge"><Fingerprint size={20} /></div>
            <p className="eyebrow">Authentication</p>
            <h1>Welcome back</h1>
            <p>Sign in with your Google account. No passwords, no friction.</p>
          </div>

          <button
            className={`btn login-google-btn full ${loading ? 'loading' : ''}`}
            onClick={handleGoogle}
            type="button"
            disabled={loading}
          >
            <span className="google-mark">G</span>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="login-trust">
            <div><MailCheck size={14} /><span>Verified email inbox</span></div>
            <div><ShieldCheck size={14} /><span>JWT-secured sessions</span></div>
          </div>

          <p className="login-footer">
            Your verified Google email receives revision reminders. No password stored.
          </p>
        </div>
      </section>
    </main>
  )
}

function handleMove(event) {
  const el = event.currentTarget
  const bounds = el.getBoundingClientRect()
  const mx = ((event.clientX - bounds.left) / bounds.width) * 100
  const my = ((event.clientY - bounds.top) / bounds.height) * 100
  el.style.setProperty('--mx', `${mx}%`)
  el.style.setProperty('--my', `${my}%`)
}
