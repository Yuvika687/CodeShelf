import { BookOpen, Brain, Code2, Fingerprint, Flame, Headphones, MailCheck, ShieldCheck, Terminal, Zap } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await signup(name.trim(), email.trim(), password)
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
            <h2>Create your account</h2>
            <p>Takes less than a minute.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="login-divider"><span>already have an account?</span></div>

          <p className="login-legal" style={{ textAlign: 'center' }}>
            <Link to="/login" state={location.state}>Sign in</Link>
          </p>

          <div className="login-trust-row">
            <div><MailCheck size={15} /><span>Verified Email</span></div>
            <div><ShieldCheck size={15} /><span>JWT Auth</span></div>
            <div><Zap size={15} /><span>Zero Latency</span></div>
          </div>
        </div>
      </section>
    </main>
  )
}
