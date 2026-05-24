import { AlertTriangle, Flame, Plus, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { mistakesApi } from '../api/client.js'
import { Field } from './Upload.jsx'

const empty = { mistake_title: '', wrong_approach: '', correct_approach: '', reason: '', prevention_tip: '', topic: 'DSA', generate_card: true }

export default function MistakeBook() {
  const [mistakes, setMistakes] = useState([])
  const [form, setForm] = useState(empty)
  const [topic, setTopic] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { load() }, [topic])
  const load = () => mistakesApi.list({ topic }).then((data) => setMistakes(data.mistakes || [])).catch((err) => setError(err.message))
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  async function submit(event) {
    event.preventDefault()
    await mistakesApi.create(form)
    setForm(empty)
    load()
  }
  return (
    <div className="page mistake-page">
      <section className="mistake-hero">
        <div>
          <p className="eyebrow">Mistake radar</p>
          <h1>Mistakes become memory.</h1>
          <p>Capture wrong approaches before they repeat.</p>
        </div>
        <div className="danger-orb" aria-hidden="true"><ShieldAlert size={42} /></div>
      </section>
      <div className="mistake-stats">
        <span><AlertTriangle size={16} /> Logged <strong>{mistakes.length}</strong></span>
        <span><Flame size={16} /> Repeated <strong>{mistakes.reduce((sum, item) => sum + (item.times_repeated || 0), 0)}</strong></span>
        <span><ShieldAlert size={16} /> Topic <strong>{topic || 'All'}</strong></span>
      </div>
      <div className="toolbar"><input className="input compact" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Filter topic" /></div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="dashboard-grid mistake-grid">
        <section className="form-card mistake-form">
          <h2>Add Mistake</h2>
          <form onSubmit={submit}>
            <p className="form-step">1. What went wrong</p>
            <Field label="Mistake Title"><input className="input" value={form.mistake_title} onChange={(e) => update('mistake_title', e.target.value)} /></Field>
            <Field label="Wrong Approach"><textarea className="input" rows="3" value={form.wrong_approach} onChange={(e) => update('wrong_approach', e.target.value)} /></Field>
            <p className="form-step">2. Correct approach</p>
            <Field label="Correct Approach"><textarea className="input" rows="3" value={form.correct_approach} onChange={(e) => update('correct_approach', e.target.value)} /></Field>
            <p className="form-step">3. Prevention rule</p>
            <Field label="Prevention Tip"><input className="input" value={form.prevention_tip} onChange={(e) => update('prevention_tip', e.target.value)} /></Field>
            <button className="btn btn-primary danger-btn"><Plus size={16} /> Save Mistake</button>
          </form>
        </section>
        <section className="bento-panel mistake-list">
          <h2><AlertTriangle size={18} /> Mistakes</h2>
          <div className="list-stack">
            {mistakes.map((m) => <article className="revision-row danger-row" key={m.id}><span>{m.mistake_title}</span><small>{m.topic} / repeated {m.times_repeated}x</small><p className="muted">{m.prevention_tip}</p></article>)}
            {!mistakes.length ? <div className="visual-empty"><div className="empty-illustration danger"><ShieldAlert size={32} /></div><h3>No mistakes logged yet</h3><p>Write down the wrong pattern once, then let CodeShelf keep it visible.</p></div> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
