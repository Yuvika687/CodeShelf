import { Bell, Clock, Flame, Mail, Send, Settings2, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { emailApi, notesApi } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { Field } from './Upload.jsx'

const recommendedPrefs = {
  enabled: true,
  email_time: '08:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Calcutta',
  emails_per_day: 1,
  daily_card_count: 5,
  include_dsa: true,
  include_sql: true,
  include_devops: true,
  include_mistakes: true,
  include_summary: true,
  include_streak_alert: true,
  reminder_style: 'focused',
  subject_style: 'personal',
  selected_topics: [],
  selected_note_ids: [],
}

const styleOptions = [
  { value: 'focused', label: 'Focused' },
  { value: 'calm', label: 'Calm' },
  { value: 'coach-like', label: 'Coach' },
]

export default function EmailSettings() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(null)
  const [preview, setPreview] = useState(null)
  const [advanced, setAdvanced] = useState(false)
  const [notes, setNotes] = useState([])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    emailApi.preferences().then((data) => setPrefs(data.preferences)).catch((err) => setError(err.message))
    notesApi.list({}).then((data) => setNotes(data.notes || [])).catch(() => setNotes([]))
  }, [])

  const enabledSummary = useMemo(() => {
    if (!prefs?.enabled) return 'Paused'
    return `${prefs.emails_per_day || 1} email${(prefs.emails_per_day || 1) === 1 ? '' : 's'}/day from ${prefs.email_time}`
  }, [prefs])
  const scheduleLine = prefs?.enabled ? `Next eligible send: ${prefs.next_send_label || 'after the next cron window'}` : 'Daily emails are paused.'
  const sendTimes = useMemo(() => {
    const [hour, minute] = String(prefs?.email_time || '').split(':').map(Number)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return prefs?.send_times || []
    const count = Math.max(1, Math.min(10, Number(prefs?.emails_per_day) || 1))
    return Array.from({ length: count }, (_, index) => `${String((hour + index) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }, [prefs])
  const slotLine = sendTimes.length ? `Today's slots: ${sendTimes.join(', ')}` : 'Saved time becomes the first email slot.'
  const topics = useMemo(() => Array.from(new Set(notes.map((note) => note.topic).filter(Boolean))).sort(), [notes])
  const scopedNotes = useMemo(() => {
    const selectedTopics = prefs?.selected_topics || []
    if (!selectedTopics.length) return notes
    return notes.filter((note) => selectedTopics.includes(note.topic))
  }, [notes, prefs])

  const update = (key, value) => setPrefs((current) => ({ ...current, [key]: value }))
  const toggleListValue = (key, value) => {
    setPrefs((current) => {
      const existing = current?.[key] || []
      const next = existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value]
      return { ...current, [key]: next }
    })
  }

  async function run(label, action) {
    setError('')
    setMessage('')
    setBusy(label)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function save(nextPrefs = prefs) {
    await run('save', async () => {
      const data = await emailApi.updatePreferences(nextPrefs)
      setPrefs(data.preferences)
      setMessage(`Email settings saved. Next daily email is eligible ${data.preferences.next_send_label || 'at the next cron window'}.`)
    })
  }

  async function applyRecommended() {
    const next = { ...prefs, ...recommendedPrefs, enabled: Boolean(user?.email_verified) }
    setPrefs(next)
    await save(next)
    await loadPreview()
  }

  async function loadPreview() {
    await run('preview', async () => setPreview(await emailApi.preview()))
  }

  async function sendTest() {
    await run('test', async () => {
      const data = await emailApi.sendTest()
      if (data.status === 'failed') {
        throw new Error(data.error_message || 'Email provider rejected the test email.')
      }
      if (data.status === 'printed') {
        setMessage('Test email was printed in backend logs because RESEND_API_KEY is not configured for this environment.')
        return
      }
      setMessage(`Test email ${data.status}. Check ${user?.email || 'your verified inbox'}.`)
    })
  }

  if (!prefs) return <div className="page"><p className="muted">Loading email brain...</p></div>

  return (
    <div className="page email-studio email-brain-page">
      <section className="email-brain-hero">
        <div>
          <p className="eyebrow">Inbox memory engine</p>
          <h1>One email. One recall sprint. No setup headache.</h1>
          <p>CodeShelf sends a compact daily memory pack with weak topics, mistakes, formulas, and due cards.</p>
          <div className="email-hero-actions">
            <button className="btn btn-primary" onClick={applyRecommended} disabled={busy === 'save'}>
              <Sparkles size={16} /> Use Best Settings
            </button>
            <button className="btn btn-secondary" onClick={sendTest} disabled={busy === 'test'}>
              <Send size={16} /> Send Test
            </button>
          </div>
        </div>
        <div className="email-status-orb">
          <Mail size={30} />
          <strong>{enabledSummary}</strong>
          <span>{prefs.daily_card_count} cards each</span>
        </div>
      </section>

      {!user?.email_verified ? (
        <section className="verify-banner">
          <ShieldCheck size={20} />
          <div><strong>Google verification required.</strong><span>Reminders can be enabled only for your verified Google email.</span></div>
        </section>
      ) : null}

      <div className="email-schedule-strip">
        <Clock size={16} />
        <strong>{scheduleLine}</strong>
        <span>{slotLine}</span>
      </div>

      <div className="email-brain-grid">
        <section className="email-simple-panel">
          <div className="email-panel-head">
            <div><p className="eyebrow">Recommended loop</p><h2>Daily recall sprint</h2></div>
            <button className={`switch ${prefs.enabled ? 'on' : ''}`} type="button" onClick={() => update('enabled', !prefs.enabled)}><span /></button>
          </div>

          <div className="email-pill-grid">
            <SmartPill icon={Clock} label="Saved time" value={prefs.email_time} />
            <SmartPill icon={Mail} label="Emails" value={`${prefs.emails_per_day || 1}/day`} />
            <SmartPill icon={Bell} label="Cards" value={`${prefs.daily_card_count}/email`} />
            <SmartPill icon={Flame} label="Streak" value={`${user?.current_streak || 0} days`} />
          </div>

          <Field label="How many emails per day?">
            <input className="input" type="range" min="1" max="10" value={prefs.emails_per_day || 1} onChange={(e) => update('emails_per_day', Number(e.target.value))} />
          </Field>

          <div className="email-count-strip">
            {[1, 2, 3, 5, 10].map((count) => (
              <button key={count} type="button" className={(prefs.emails_per_day || 1) === count ? 'active' : ''} onClick={() => update('emails_per_day', count)}>{count}</button>
            ))}
          </div>

          <Field label="How many cards per email?">
            <input className="input" type="range" min="3" max="10" value={prefs.daily_card_count} onChange={(e) => update('daily_card_count', Number(e.target.value))} />
          </Field>

          <div className="email-count-strip">
            {[3, 5, 7, 10].map((count) => (
              <button key={count} type="button" className={prefs.daily_card_count === count ? 'active' : ''} onClick={() => update('daily_card_count', count)}>{count}</button>
            ))}
          </div>

          <Field label="Reminder voice">
            <div className="choice-grid email-choice-grid">
              {styleOptions.map((option) => <button className={prefs.reminder_style === option.value ? 'active' : ''} type="button" key={option.value} onClick={() => update('reminder_style', option.value)}>{option.label}</button>)}
            </div>
          </Field>

          <section className="email-scope">
            <div className="email-scope-head">
              <div>
                <p className="eyebrow">Email scope</p>
                <h3>Choose what this email can pull from</h3>
              </div>
              <button type="button" onClick={() => setPrefs((current) => ({ ...current, selected_topics: [], selected_note_ids: [] }))}>Use all</button>
            </div>
            <div className="email-scope-row">
              {topics.map((topic) => (
                <button type="button" key={topic} className={(prefs.selected_topics || []).includes(topic) ? 'active' : ''} onClick={() => toggleListValue('selected_topics', topic)}>{topic}</button>
              ))}
              {!topics.length ? <span>No topics yet</span> : null}
            </div>
            <div className="email-note-picker">
              {scopedNotes.slice(0, 18).map((note) => (
                <button type="button" key={note.id} className={(prefs.selected_note_ids || []).includes(note.id) ? 'active' : ''} onClick={() => toggleListValue('selected_note_ids', note.id)}>
                  <strong>{note.title}</strong>
                  <span>{note.topic}</span>
                </button>
              ))}
              {!scopedNotes.length ? <p className="muted">No notes match this topic scope.</p> : null}
            </div>
            <p className="email-scope-help">
              {(prefs.selected_note_ids || []).length
                ? `Email will use only ${prefs.selected_note_ids.length} selected note${prefs.selected_note_ids.length === 1 ? '' : 's'}.`
                : (prefs.selected_topics || []).length
                  ? `Email will use notes/cards from: ${prefs.selected_topics.join(', ')}.`
                  : 'Email can use all due cards, controlled by the topic switches below.'}
            </p>
          </section>

          <button type="button" className="advanced-toggle" onClick={() => setAdvanced((value) => !value)}>
            <Settings2 size={15} /> {advanced ? 'Hide advanced controls' : 'Advanced controls'}
          </button>

          {advanced ? (
            <div className="email-advanced">
              <div className="two-col">
                <Field label="Email Time"><input className="input" value={prefs.email_time} onChange={(e) => update('email_time', e.target.value)} placeholder="08:00" /></Field>
                <Field label="Timezone"><input className="input" value={prefs.timezone} onChange={(e) => update('timezone', e.target.value)} placeholder="Asia/Calcutta" /></Field>
              </div>
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
                <CheckItem label="Summary" checked={prefs.include_summary} onChange={() => update('include_summary', !prefs.include_summary)} />
                <CheckItem label="Streak rescue" checked={prefs.include_streak_alert} onChange={() => update('include_streak_alert', !prefs.include_streak_alert)} />
              </div>
            </div>
          ) : null}

          {message ? <p className="form-success">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <button className="btn btn-primary" onClick={() => save()} disabled={busy === 'save'}>Save</button>
            <button className="btn btn-secondary" onClick={loadPreview} disabled={busy === 'preview'}>Preview</button>
          </div>
        </section>

        <section className="email-preview-card">
          <div className="email-preview-header">
            <Clock size={14} />
            <span>{prefs.email_time} / {prefs.timezone}</span>
            <span className="email-preview-dot" />
          </div>
          {preview ? (
            <div className="email-preview-body">
              <strong className="email-preview-subject">{preview.subject}</strong>
              <pre className="email-preview-text">{preview.body}</pre>
            </div>
          ) : (
            <div className="email-preview-empty">
              <div className="email-preview-icon"><Mail size={32} /></div>
              <strong>Memory sprint preview</strong>
              <span>Preview shows exactly what the user receives: due cards, weak topics, streak status, and one-click review.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function SmartPill({ icon: Icon, label, value }) {
  return <div className="smart-pill"><Icon size={16} /><span>{label}</span><strong>{value}</strong></div>
}

function CheckItem({ label, checked, onChange }) {
  return <button type="button" className={`check-pill ${checked ? 'active' : ''}`} onClick={onChange}>{label}</button>
}
