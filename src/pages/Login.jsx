import { BookOpen, Brain, Code2, Fingerprint, Flame, Headphones, MailCheck, ShieldCheck, Sparkles, Terminal, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(null)

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

  function handleMove(e) {
    const el = pageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`)
  }

  return (
    <main ref={pageRef} className="login-page" onPointerMove={handleMove}>
      {/* Animated background */}
      <div className="login-bg" aria-hidden="true">
        <div className="login-grid-lines" />
        <span className="login-orb o1" />
        <span className="login-orb o2" />
        <span className="login-orb o3" />
      </div>

      {/* Left — Hero */}
      <section className="login-hero">
        <Link to="/" className="login-logo">
          <span className="login-logo-icon"><Code2 size={20} /></span>
          CodeShelf
        </Link>

        <div className="login-headline">
          <p className="login-eyebrow">⟨/⟩ Spaced Repetition for Developers</p>
          <h1>Learn once.<br /><em>Keep it forever.</em></h1>
          <p className="login-desc">Transform notes, mistakes, and solved problems into a revision engine powered by AI cards, walk-mode audio, and streak reminders.</p>
        </div>

        <div className="login-stats-row">
          <div className="login-stat">
            <Brain size={18} />
            <div><strong>SM-2 Algorithm</strong><span>Spaced repetition</span></div>
          </div>
          <div className="login-stat">
            <Headphones size={18} />
            <div><strong>Walk Mode</strong><span>Audio revision</span></div>
          </div>
          <div className="login-stat">
            <Flame size={18} />
            <div><strong>Streaks</strong><span>Daily tracking</span></div>
          </div>
        </div>

        <div className="login-modules">
          {[
            { icon: BookOpen, label: 'Knowledge Library', desc: '6 note types with code snippets' },
            { icon: Sparkles, label: 'AI Card Engine', desc: 'Auto-generate recall flashcards' },
            { icon: Terminal, label: 'Problem Tracker', desc: 'LeetCode patterns + GitHub sync' },
          ].map(({ icon: Icon, label, desc }) => (
            <div className="login-module" key={label}>
              <div className="login-module-icon"><Icon size={16} /></div>
              <strong>{label}</strong>
              <span>{desc}</span>
            </div>
          ))}
        </div>

        {/* Floating code snippets */}
        <div className="login-floaters" aria-hidden="true">
          <code className="floater f1">recall.cards(due=today)</code>
          <code className="floater f2">streak.check(min=5)</code>
          <code className="floater f3">walk_mode.speak(q)</code>
        </div>
      </section>

      {/* Right — Auth Card */}
      <section className="login-auth">
        <div className="login-auth-glow" aria-hidden="true" />
        <div className="login-auth-card">
          <div className="login-auth-head">
            <div className="login-auth-badge">
              <Fingerprint size={24} />
              <span className="badge-ring r1" />
              <span className="badge-ring r2" />
            </div>
            <h2>Welcome to CodeShelf</h2>
            <p>One-click sign in. No passwords, ever.</p>
          </div>

          <button
            className={`login-google ${loading ? 'is-loading' : ''}`}
            onClick={handleGoogle}
            type="button"
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

          {error && <p className="form-error">{error}</p>}

          <div className="login-divider"><span>secured by</span></div>

          <div className="login-trust-row">
            <div><MailCheck size={15} /><span>Verified Email</span></div>
            <div><ShieldCheck size={15} /><span>JWT Auth</span></div>
            <div><Zap size={15} /><span>Zero Latency</span></div>
          </div>

          <p className="login-legal">
            Your verified Google email receives revision reminders.<br />No password is ever stored.
          </p>
        </div>
      </section>
    </main>
  )
}
