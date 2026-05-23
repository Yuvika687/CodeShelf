import { Code2, MailCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Field } from './Upload.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, loginWithGoogle } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const verified = searchParams.get('verified')
    if (verified === 'success') setNotice('Email verified. Your welcome email is on the way.')
    if (verified === 'invalid') setError('Verification link expired. Sign in to request a fresh link.')
  }, [searchParams])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      await login(form)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleGoogle() {
    setError('')
    setNotice('')
    try {
      await loginWithGoogle()
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AuthShell title="Enter your coding memory vault" subtitle="Use verified Google sign-in or your confirmed email account.">
      <button className="btn google-button full" onClick={handleGoogle} type="button">
        <span className="google-mark">G</span>
        Continue with Google
      </button>
      <div className="auth-divider"><span>or use email</span></div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@domain.com" required /></Field>
        <Field label="Password"><input className="input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password" required /></Field>
        {notice ? <p className="form-success">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn btn-primary full">Sign In</button>
      </form>
      <p className="auth-footer">New to CodeShelf? <Link to="/signup">Create a verified account</Link></p>
    </AuthShell>
  )
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <main className="auth-page luxury-auth">
      <section className="auth-story">
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
