import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Field } from './Upload.jsx'
import { AuthShell } from './Login.jsx'

export default function Signup() {
  const { signup, loginWithGoogle } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const data = await signup(form)
      setMessage(data.message || 'Check your inbox to verify your email.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleGoogle() {
    setError('')
    setMessage('')
    try {
      await loginWithGoogle()
      window.location.href = '/'
    } catch (err) {
      setError(err.message)
    }
  }

  async function resend() {
    if (!form.email) return setError('Enter your email first.')
    const data = await authApi.resendVerification(form.email)
    setMessage(data.message)
  }

  return (
    <AuthShell title="Build a verified memory shelf" subtitle="Verify your email before reminders are enabled, or use Google for instant verified access.">
      <button className="btn google-button full" onClick={handleGoogle} type="button">
        <span className="google-mark">G</span>
        Continue with Google
      </button>
      <div className="auth-divider"><span>or verify email</span></div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <Field label="Full Name"><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Yogender" required /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@domain.com" required /></Field>
        <Field label="Password"><input className="input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" required /></Field>
        {message ? <p className="form-success">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn btn-primary full">Create Account</button>
      </form>
      <button className="text-button" type="button" onClick={resend}>Resend verification email</button>
      <p className="auth-footer">Already verified? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  )
}
