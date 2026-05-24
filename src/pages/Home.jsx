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
    <div className="page">
      <section className="hero revision-hero">
        <div>
          <p className="eyebrow">CodeShelf</p>
          <h1>Never forget what you already learned.</h1>
          <p>Turn DSA, SQL, DevOps commands, mistakes, and interview concepts into a daily coding memory system.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/revision/today"><Brain size={16} /> Start Today</Link>
            <Link className="btn btn-secondary" to="/add-note"><Plus size={16} /> Add Learning</Link>
          </div>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="stats-grid">
        <Metric icon={CalendarCheck} label="Due Today" value={due} color="#8b5cf6" />
        <Metric icon={Flame} label="Current Streak" value={dashboard?.streak?.current || 0} color="#f59e0b" />
        <Metric icon={BookOpen} label="Notes" value={stats.notes || 0} color="#10b981" />
        <Metric icon={Route} label="Problems" value={stats.problems || 0} color="#3b82f6" />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-header">
            <h2>Today Revision</h2>
            <Link to="/revision/today" className="btn btn-secondary">Open</Link>
          </div>
          <div className="list-stack">
            {(dashboard?.today?.cards || []).map((card) => (
              <article className="revision-row" key={card.id}>
                <span><Brain size={16} /> {card.question}</span>
                <small>{card.topic} · {card.difficulty}</small>
              </article>
            ))}
            {!dashboard?.today?.cards?.length ? <Empty text="No due cards yet. Add a note or problem to generate revision cards." /> : null}
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <h2>Weak Topics</h2>
            <ShieldAlert size={18} />
          </div>
          <div className="topic-chip-row">
            {(dashboard?.weak_topics || []).map((item) => <span className="topic-chip" key={item.topic}>{item.topic} · {item.due}</span>)}
            {!dashboard?.weak_topics?.length ? <p className="muted">Weak topics appear as reviews become due or difficult.</p> : null}
          </div>
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-header"><h2>Recent Notes</h2><Link to="/library">Library</Link></div>
          <div className="list-stack">
            {(dashboard?.recent_notes || []).map((note) => <Link className="revision-row" to={`/note/${note.id}`} key={note.id}><span>{note.title}</span><small>{note.topic} · {note.note_type}</small></Link>)}
            {!dashboard?.recent_notes?.length ? <Empty text="Your knowledge library is waiting." /> : null}
          </div>
        </section>
        <section className="card">
          <div className="section-header"><h2>Recent Mistakes</h2><AlertTriangle size={18} /></div>
          <div className="list-stack">
            {(dashboard?.recent_mistakes || []).map((mistake) => <article className="revision-row" key={mistake.id}><span>{mistake.mistake_title}</span><small>{mistake.topic}</small></article>)}
            {!dashboard?.recent_mistakes?.length ? <Empty text="Log mistakes so they become interview-safe recall cards." /> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, color }) {
  return <div className="card metric-card"><div style={{ color }}><Icon size={22} /></div><strong>{value}</strong><span>{label}</span></div>
}

function Empty({ text }) {
  return <p className="muted empty-state">{text}</p>
}
