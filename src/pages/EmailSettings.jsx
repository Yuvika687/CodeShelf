import { Clock, Mail, Palette, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { emailApi } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Field } from './Upload.jsx'

const styleOptions = [
  { value: 'focused', label: 'Focused' },
  { value: 'calm', label: 'Calm' },
  { value: 'coach-like', label: 'Coach' },
]

export default function EmailSettings() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(null)
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { emailApi.preferences().then((data) => setPrefs(data.preferences)) }, [])

  const update = (key, value) => setPrefs((current) => ({ ...current, [key]: value }))

  async function run(action) {
    setError('')
    setMessage('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
    }
  }

  async function save() {
    await run(async () => {
      const data = await emailApi.updatePreferences(prefs)
      setPrefs(data.preferences)
      setMessage('Email preferences saved.')
    })
  }

  async function loadPreview() {
    await run(async () => setPreview(await emailApi.preview()))
  }

  async function sendTest() {
    await run(async () => {
      const data = await emailApi.sendTest()
      setMessage(`Email ${data.status}.`)
    })
  }

  if (!prefs) return <div className="page"><p className="muted">Loading email settings...</p></div>

  return (
    <div className="page email-studio">
      <section className="email-hero"><div><p className="eyebrow">Inbox coach</p><h1>Email Studio</h1><p>Verified inbox reminders, tuned to how you revise.</p></div><div className="mail-visual" aria-hidden="true"><Mail size={40} /></div></section>
      {!user?.email_verified ? (
        <section className="verify-banner">
          <ShieldCheck size={20} />
          <div><strong>Google verification required.</strong><span>CodeShelf sends reminders only to the verified email returned by Google sign-in.</span></div>
        </section>
      ) : null}
      <div className="email-layout">
        <section className="card form-card email-control-panel">
          <h2><Mail size={18} /> Delivery</h2>
          <div className="toggle-row">
            <div><strong>Daily reminders</strong><span>Send due cards and weak topics to your verified inbox.</span></div>
            <button className={`switch ${prefs.enabled ? 'on' : ''}`} type="button" onClick={() => update('enabled', !prefs.enabled)}><span /></button>
          </div>
          <div className="two-col">
            <Field label="Email Time"><input className="input" value={prefs.email_time} onChange={(e) => update('email_time', e.target.value)} placeholder="08:00" /></Field>
            <Field label="Timezone"><input className="input" value={prefs.timezone} onChange={(e) => update('timezone', e.target.value)} placeholder="Asia/Calcutta" /></Field>
          </div>
          <Field label="Daily Card Count"><input className="input" type="number" min="1" max="20" value={prefs.daily_card_count} onChange={(e) => update('daily_card_count', Number(e.target.value))} /></Field>

          <h2><Palette size={18} /> Personalization</h2>
          <Field label="Reminder Style">
            <div className="choice-grid">
              {styleOptions.map((option) => <button className={prefs.reminder_style === option.value ? 'active' : ''} type="button" key={option.value} onClick={() => update('reminder_style', option.value)}>{option.label}</button>)}
            </div>
          </Field>
          <Field label="Subject Line">
            <select className="input" value={prefs.subject_style} onChange={(e) => update('subject_style', e.target.value)}>
              <option value="personal">Personal revision</option>
              <option value="streak">Streak protection</option>
            </select>
          </Field>
          <div className="check-grid">
            <CheckItem label="DSA" checked={prefs.include_dsa} onChange={() => update('include_dsa', !prefs.include_dsa)} />
            <CheckItem label="SQL" checked={prefs.include_sql} onChange={() => update('include_sql', !prefs.include_sql)} />
            <CheckItem label="DevOps" checked={prefs.include_devops} onChange={() => update('include_devops', !prefs.include_devops)} />
            <CheckItem label="Mistakes" checked={prefs.include_mistakes} onChange={() => update('include_mistakes', !prefs.include_mistakes)} />
            <CheckItem label="Summary block" checked={prefs.include_summary} onChange={() => update('include_summary', !prefs.include_summary)} />
            <CheckItem label="Streak alerts" checked={prefs.include_streak_alert} onChange={() => update('include_streak_alert', !prefs.include_streak_alert)} />
          </div>
          {message ? <p className="form-success">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn btn-secondary" onClick={loadPreview}>Preview</button>
            <button className="btn btn-secondary" onClick={sendTest}><Send size={16} /> Send Test</button>
          </div>
        </section>
        <section className="email-preview-device">
          <div className="device-bar"><Clock size={14} /> {prefs.email_time} / {prefs.timezone}</div>
          {preview ? (
            <article>
              <strong>{preview.subject}</strong>
              <pre>{preview.body}</pre>
            </article>
          ) : (
            <article className="empty-preview">
              <Mail size={28} />
              <strong>Your reminder preview appears here.</strong>
              <span>Generate one after saving your style and topic preferences.</span>
            </article>
          )}
        </section>
      </div>
    </div>
  )
}

function CheckItem({ label, checked, onChange }) {
  return <button type="button" className={`check-pill ${checked ? 'active' : ''}`} onClick={onChange}>{label}</button>
}
