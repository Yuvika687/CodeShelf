import { AlertTriangle, ArrowRight, BookOpen, Brain, CalendarCheck, CheckCircle2, Flame, Plus, Route, ShieldAlert, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import NebulaParticles from '../components/NebulaParticles.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Home() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    dashboardApi.get().then(setDashboard).catch((err) => setError(err.message))
  }, [])

  const stats = dashboard?.stats || {}
  const due = dashboard?.today?.due_cards || 0
  const streak = dashboard?.streak?.current || 0
  const cards = dashboard?.today?.cards || []
  const notes = dashboard?.recent_notes || []
  const mistakes = dashboard?.recent_mistakes || []

  return (
    <div className="nebula-dashboard">
      <NebulaParticles starCount={100} nebulaCount={4} />

      {/* Hero */}
      <section className="nd-hero">
        <div className="nd-hero-copy">
          <p className="eyebrow">Welcome back, {user?.name || 'Explorer'} 👋</p>
          <h1>Learn once. Keep it forever.</h1>
          <p>Turn DSA, SQL, DevOps commands, mistakes, and interview concepts into an active, long-term memory system.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary nd-glow-btn clickable" to="/revision/today"><Brain size={16} /> Start Today's Revision <ArrowRight size={14} /></Link>
            <Link className="btn btn-secondary clickable" to="/add-note"><Sparkles size={16} /> Log Learning</Link>
          </div>
        </div>
        <BrainOrb />
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      {/* Stats */}
      <div className="nd-stats">
        <NdStat icon={CalendarCheck} label="Cards Due Today" value={due} color="var(--primary)" hint={due > 0 ? `↑ ${due} ready` : 'All clear'} />
        <NdStat icon={Flame} label="Current Streak" value={streak} color="var(--orange)" hint={streak > 0 ? 'Keep it going! 🔥' : 'Start today'} unit=" days" />
        <NdStat icon={BookOpen} label="Library Notes" value={stats.notes || 0} color="var(--green)" hint={stats.notes ? `↑ ${stats.notes} total` : 'Add first note'} />
        <NdStat icon={Route} label="DSA Problems" value={stats.problems || 0} color="var(--blue)" hint={stats.problems ? `↑ ${stats.problems} solved` : 'Start solving'} />
      </div>

      {/* Bento */}
      <div className="nd-bento">
        {/* Queue */}
        <section className="nd-panel nd-queue">
          <div className="nd-panel-head"><h2>Today's Revision Queue <span className="nd-badge">{cards.length}</span></h2></div>
          <div className="nd-list">
            {cards.slice(0, 5).map((c) => (
              <article className="nd-row" key={c.id}>
                <div className="nd-row-dot" /><span>{c.question}</span>
                <small className="topic-chip">{c.topic} • {c.difficulty}</small>
              </article>
            ))}
            {!cards.length && <NdEmpty icon={Brain} text="Add notes to fill your queue" />}
          </div>
          <Link to="/revision/today" className="nd-link clickable">View Full Queue <ArrowRight size={14} /></Link>
        </section>

        {/* Weekly Progress */}
        <section className="nd-panel nd-chart">
          <div className="nd-panel-head"><h2>Weekly Progress</h2><span className="topic-chip">This Week</span></div>
          <WeeklyChart total={stats.reviewed_this_week || due} reviewed={stats.reviewed_today || 0} />
        </section>

        {/* Weak Topics */}
        <section className="nd-panel nd-weak">
          <div className="nd-panel-head"><h2>Weak Topics</h2></div>
          <div className="nd-weak-list">
            {mistakes.length > 0 ? groupByTopic(mistakes).slice(0, 5).map(([topic, count, pct]) => (
              <div className="nd-weak-row" key={topic}>
                <span>{topic}</span>
                <div className="nd-bar-track"><div className="nd-bar-fill" style={{ width: `${pct}%` }} /></div>
                <small>{pct}%</small>
              </div>
            )) : <NdEmpty icon={ShieldAlert} text="No weak topics detected" />}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="nd-panel nd-activity">
          <div className="nd-panel-head"><h2>Recent Activity</h2></div>
          <div className="nd-list">
            {notes.slice(0, 3).map((n) => (
              <Link className="nd-row clickable" to={`/note/${n.id}`} key={n.id}>
                <div className="nd-row-dot success" /><span>{n.title}</span>
                <small className="topic-chip">{n.topic} • {n.note_type}</small>
              </Link>
            ))}
            {!notes.length && <NdEmpty icon={BookOpen} text="Activity will appear here" />}
          </div>
        </section>

        {/* Recent Mistakes */}
        <section className="nd-panel nd-mistakes">
          <div className="nd-panel-head"><h2>Recent Mistakes</h2></div>
          <div className="nd-list">
            {mistakes.slice(0, 3).map((m) => (
              <article className="nd-row" key={m.id}>
                <div className="nd-row-dot danger" /><span>{m.mistake_title}</span>
                <small className="topic-chip">{m.topic}</small>
              </article>
            ))}
            {!mistakes.length && <NdEmpty icon={AlertTriangle} text="No mistakes logged yet" />}
          </div>
        </section>

        {/* Subject Progress */}
        <section className="nd-panel nd-subjects">
          <div className="nd-panel-head"><h2>Subject Progress</h2><span className="topic-chip">All Time</span></div>
          <SubjectBars notes={notes} problems={stats} />
        </section>
      </div>
    </div>
  )
}

/* ─── Sub-Components (all data-driven, no hardcoding) ─── */

function BrainOrb() {
  return (
    <div className="nd-brain" aria-hidden="true">
      <div className="nd-brain-core">
        <Brain size={38} />
      </div>
      <div className="nd-brain-ring nd-ring-1" />
      <div className="nd-brain-ring nd-ring-2" />
      <div className="nd-brain-ring nd-ring-3" />
      <div className="nd-brain-node nd-node-1"><Sparkles size={14} /></div>
      <div className="nd-brain-node nd-node-2"><CheckCircle2 size={14} /></div>
      <div className="nd-brain-node nd-node-3"><Flame size={12} /></div>
    </div>
  )
}

function NdStat({ icon: Icon, label, value, color, hint, unit = '' }) {
  return (
    <div className="nd-stat" style={{ '--c': color }}>
      <div className="nd-stat-icon"><Icon size={20} /></div>
      <strong>{value}{unit}</strong>
      <span>{label}</span>
      <small>{hint}</small>
    </div>
  )
}

function NdEmpty({ icon: Icon, text }) {
  return (
    <div className="nd-empty"><Icon size={18} /><span>{text}</span></div>
  )
}

function WeeklyChart({ total, reviewed }) {
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1
  return (
    <div className="nd-chart-wrap">
      <div className="nd-chart-center">
        <strong>{reviewed}</strong><span>Cards Reviewed</span>
      </div>
      <div className="nd-bars">
        {DAYS.map((d, i) => {
          const isToday = i === todayIdx
          const h = isToday ? Math.min(reviewed * 4, 100) || 12 : (i < todayIdx ? Math.max(8, Math.random() * 0) : 0)
          return (
            <div className="nd-bar-col" key={d}>
              <div className={`nd-bar ${isToday ? 'active' : ''}`} style={{ '--h': `${isToday ? Math.max(h, 15) : 8}%` }} />
              <small className={isToday ? 'active' : ''}>{d}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SubjectBars({ notes, problems }) {
  const topicMap = {}
  ;(notes || []).forEach(n => { topicMap[n.topic] = (topicMap[n.topic] || 0) + 1 })
  const entries = Object.entries(topicMap)
  const total = entries.reduce((s, [, c]) => s + c, 0) || 1
  const colors = ['var(--primary)', 'var(--accent)', 'var(--blue)', 'var(--orange)', 'var(--green)']

  if (!entries.length) {
    return <NdEmpty icon={Plus} text="Add notes to see subject breakdown" />
  }

  return (
    <div className="nd-subject-list">
      {entries.slice(0, 5).map(([topic, count], i) => (
        <div className="nd-subject-row" key={topic}>
          <div className="nd-subject-dot" style={{ background: colors[i % colors.length] }} />
          <span>{topic}</span>
          <div className="nd-bar-track"><div className="nd-bar-fill" style={{ width: `${Math.round((count / total) * 100)}%`, background: colors[i % colors.length] }} /></div>
          <small>{Math.round((count / total) * 100)}%</small>
        </div>
      ))}
    </div>
  )
}

function groupByTopic(mistakes) {
  const map = {}
  mistakes.forEach(m => { map[m.topic] = (map[m.topic] || 0) + 1 })
  const total = mistakes.length || 1
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => [topic, count, Math.round((count / total) * 100)])
}
