import { AlertTriangle, BookOpen, Brain, CalendarCheck, Flame, Plus, Route, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../api/client.js'

export default function Home() {
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    dashboardApi.get().then(setDashboard).catch((err) => setError(err.message))
  }, [])

  const stats = dashboard?.stats || {}
  const due = dashboard?.today?.due_cards || 0

  return (
    <div className="page dashboard-root">
      <section className="hero revision-hero card">
        <div className="hero-content">
          <p className="eyebrow">CODESHELF INTELLIGENT WORKSPACE</p>
          <h1>Learn once. Remember forever.</h1>
          <p>Turn DSA, SQL, DevOps commands, mistakes, and interview concepts into an active daily coding memory system.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary clickable" to="/revision/today"><Brain size={16} /> Start Daily Queue</Link>
            <Link className="btn btn-secondary clickable" to="/add-note"><Plus size={16} /> Log Learning</Link>
          </div>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="stats-grid">
        <MetricCard icon={CalendarCheck} label="Due Today" value={due} color="var(--primary)" />
        <MetricCard icon={Flame} label="Current Streak" value={dashboard?.streak?.current || 0} color="var(--orange)" />
        <MetricCard icon={BookOpen} label="Library Notes" value={stats.notes || 0} color="var(--green)" />
        <MetricCard icon={Route} label="DSA Problems" value={stats.problems || 0} color="var(--accent)" />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-header">
            <h2>Today's Revision Queue</h2>
            <Link to="/revision/today" className="btn btn-secondary compact clickable">Open Queue</Link>
          </div>
          <div className="list-stack">
            {(dashboard?.today?.cards || []).slice(0, 5).map((card) => (
              <article className="revision-row" key={card.id}>
                <span><Brain size={16} style={{ marginRight: '8px', color: 'var(--primary)' }} /> {card.question}</span>
                <small className="topic-chip">{card.topic} · {card.difficulty}</small>
              </article>
            ))}
            {!dashboard?.today?.cards?.length ? <Empty text="No due cards yet. Add a note or problem to generate revision cards." /> : null}
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <h2>Vulnerable Focus Areas</h2>
            <ShieldAlert size={18} color="var(--primary)" />
          </div>
          <div className="topic-chip-row">
            {(dashboard?.weak_topics || []).map((item) => (
              <span className="topic-chip" key={item.topic}>{item.topic} · {item.due} due</span>
            ))}
            {!dashboard?.weak_topics?.length ? <p className="muted">Focus areas will populate as active recall intervals trigger.</p> : null}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-header">
            <h2>Recent Knowledge Notes</h2>
            <Link to="/library" className="btn btn-secondary compact clickable">Library</Link>
          </div>
          <div className="list-stack">
            {(dashboard?.recent_notes || []).slice(0, 5).map((note) => (
              <Link className="revision-row clickable" to={`/note/${note.id}`} key={note.id}>
                <span>{note.title}</span>
                <small className="topic-chip">{note.topic} · {note.note_type}</small>
              </Link>
            ))}
            {!dashboard?.recent_notes?.length ? <Empty text="Your knowledge library is waiting." /> : null}
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <h2>Danger Zone: Recent Mistakes</h2>
            <AlertTriangle size={18} color="var(--red)" />
          </div>
          <div className="list-stack">
            {(dashboard?.recent_mistakes || []).slice(0, 5).map((mistake) => (
              <article className="revision-row" key={mistake.id}>
                <span>{mistake.mistake_title}</span>
                <small className="topic-chip">{mistake.topic}</small>
              </article>
            ))}
            {!dashboard?.recent_mistakes?.length ? <Empty text="Log mistakes so they become interview-safe recall cards." /> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card metric-card">
      <div className="metric-header" style={{ color, marginBottom: '12px' }}>
        <Icon size={24} />
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-label">{label}</span>
    </div>
  )
}

function Empty({ text }) {
  return <p className="muted empty-state">{text}</p>
}

