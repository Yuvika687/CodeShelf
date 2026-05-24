import { AlertTriangle, BookOpen, Brain, CalendarCheck, CheckCircle2, Code2, Flame, Plus, Route, ShieldAlert, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../api/client.js'

const rhythm = [18, 34, 26, 46, 31, 54, 42]
const subjects = [
  ['DSA', 'var(--blue)', 44],
  ['SQL', 'var(--accent)', 32],
  ['DevOps', 'var(--orange)', 26],
  ['Mistakes', 'var(--red)', 18],
]

export default function Home() {
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    dashboardApi.get().then(setDashboard).catch((err) => setError(err.message))
  }, [])

  const stats = dashboard?.stats || {}
  const due = dashboard?.today?.due_cards || 0
  const hasMemory = Boolean(due || stats.notes || stats.problems || dashboard?.recent_notes?.length)

  return (
    <div className="page dashboard-root product-dashboard">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Welcome back</p>
          <h1>Build a coding memory that compounds.</h1>
          <p>Capture solved problems, notes, mistakes, and commands. CodeShelf turns them into a daily loop.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary clickable" to="/revision/today"><Brain size={16} /> Start Revision</Link>
            <Link className="btn btn-secondary clickable" to="/add-note"><Plus size={16} /> Add Learning</Link>
          </div>
        </div>
        <div className="memory-orb" aria-hidden="true">
          <span><Code2 size={18} /></span>
          <span><CheckCircle2 size={18} /></span>
          <span><Sparkles size={18} /></span>
        </div>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {!hasMemory ? (
        <section className="onboarding-loop">
          <div className="loop-illustration" aria-hidden="true"><Brain size={42} /></div>
          <div>
            <p className="eyebrow">Start here</p>
            <h2>Build your first memory loop</h2>
            <p>Add one useful note or solved problem. CodeShelf will generate recall cards and bring them back when they matter.</p>
          </div>
          <div className="loop-steps">
            <span>1. Add note</span>
            <span>2. Generate cards</span>
            <span>3. Revise daily</span>
          </div>
          <Link className="btn btn-primary" to="/add-note"><Plus size={16} /> Add first note</Link>
        </section>
      ) : null}

      <div className="stats-grid stat-strip">
        <MetricCard icon={CalendarCheck} label="Due Today" value={due} color="var(--primary)" trend="Ready queue" />
        <MetricCard icon={Flame} label="Current Streak" value={dashboard?.streak?.current || 0} color="var(--orange)" trend="Keep warm" />
        <MetricCard icon={BookOpen} label="Library Notes" value={stats.notes || 0} color="var(--green)" trend="Knowledge base" />
        <MetricCard icon={Route} label="DSA Problems" value={stats.problems || 0} color="var(--blue)" trend="Practice map" />
      </div>

      <div className="dashboard-bento">
        <section className="bento-panel queue-panel">
          <div className="section-header">
            <h2>Today Revision Queue</h2>
            <Link to="/revision/today" className="btn btn-secondary compact clickable">Open Queue</Link>
          </div>
          <div className="list-stack">
            {(dashboard?.today?.cards || []).slice(0, 5).map((card) => (
              <article className="revision-row" key={card.id}>
                <span><Brain size={16} style={{ marginRight: '8px', color: 'var(--primary)' }} /> {card.question}</span>
                <small className="topic-chip">{card.topic} / {card.difficulty}</small>
              </article>
            ))}
            {!dashboard?.today?.cards?.length ? <EmptyLoop /> : null}
          </div>
        </section>

        <section className="bento-panel rhythm-panel">
          <div className="section-header"><h2>Weekly Learning Rhythm</h2><span className="topic-chip">7 days</span></div>
          <div className="mini-bars">{rhythm.map((value, index) => <span key={index} style={{ '--h': `${value}%` }} />)}</div>
          <p className="muted">This chart wakes up as you review, add notes, and log solved problems.</p>
        </section>

        <section className="bento-panel weak-panel">
          <div className="section-header">
            <h2>Mistake Radar</h2>
            <AlertTriangle size={18} color="var(--red)" />
          </div>
          <div className="list-stack">
            {(dashboard?.recent_mistakes || []).slice(0, 3).map((mistake) => (
              <article className="revision-row danger-row" key={mistake.id}>
                <span>{mistake.mistake_title}</span>
                <small className="topic-chip">{mistake.topic}</small>
              </article>
            ))}
            {!dashboard?.recent_mistakes?.length ? <VisualEmpty icon={ShieldAlert} title="No danger patterns yet" text="Log mistakes so the same bug does not reach the interview twice." to="/mistakes" action="Log mistake" /> : null}
          </div>
        </section>

        <section className="bento-panel notes-panel">
          <div className="section-header">
            <h2>Recent Notes</h2>
            <Link to="/library" className="btn btn-secondary compact clickable">Library</Link>
          </div>
          <div className="list-stack">
            {(dashboard?.recent_notes || []).slice(0, 4).map((note) => (
              <Link className="revision-row clickable" to={`/note/${note.id}`} key={note.id}>
                <span>{note.title}</span>
                <small className="topic-chip">{note.topic} / {note.note_type}</small>
              </Link>
            ))}
            {!dashboard?.recent_notes?.length ? <VisualEmpty icon={BookOpen} title="Your library is waiting" text="Add one note and the revision engine has something to grow." to="/add-note" action="Add note" /> : null}
          </div>
        </section>

        <section className="bento-panel subject-panel">
          <div className="section-header"><h2>Subject Progress</h2><span className="topic-chip">Memory map</span></div>
          <div className="subject-progress">
            {subjects.map(([label, color, value]) => <ProgressLine key={label} label={label} color={color} value={hasMemory ? value : 8} />)}
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color, trend }) {
  return (
    <div className="metric-card stat-card" style={{ '--metric-color': color }}>
      <div className="metric-header"><Icon size={22} /></div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-label">{label}</span>
      <small>{trend}</small>
      <div className="metric-spark"><span /></div>
    </div>
  )
}

function EmptyLoop() {
  return (
    <div className="visual-empty compact-empty">
      <div className="empty-illustration"><Brain size={28} /></div>
      <h3>Nothing due yet</h3>
      <p>Create a note or problem and tomorrow's recall loop starts forming.</p>
      <Link className="btn btn-primary compact" to="/add-note">Add learning</Link>
    </div>
  )
}

function VisualEmpty({ icon: Icon, title, text, to, action }) {
  return (
    <div className="visual-empty">
      <div className="empty-illustration"><Icon size={28} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="btn btn-secondary compact" to={to}>{action}</Link>
    </div>
  )
}

function ProgressLine({ label, color, value }) {
  return (
    <div className="progress-line" style={{ '--line-color': color, '--line-value': `${value}%` }}>
      <span>{label}</span>
      <div><i /></div>
      <small>{value}%</small>
    </div>
  )
}
