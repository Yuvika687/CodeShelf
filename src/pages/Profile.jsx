import { Activity, CalendarDays, ChevronRight, Code2, Cpu, Flame, Globe, Mail, Rocket, Shield, Sparkles, Star, Target, Terminal, Trophy, User, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { activityApi } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import NebulaParticles from '../components/NebulaParticles.jsx'

export default function Profile() {
  const { user } = useAuth()
  const [streak, setStreak] = useState(null)
  const [activity, setActivity] = useState([])

  useEffect(() => {
    activityApi.streak().then(setStreak).catch(() => {})
    activityApi.activity().then((data) => setActivity(data.activity || [])).catch(() => {})
  }, [])

  const totalCards = activity.reduce((sum, d) => sum + (d.cards_reviewed || 0), 0)
  const totalMistakes = activity.reduce((sum, d) => sum + (d.mistakes_fixed || 0), 0)
  const completeDays = activity.filter(d => d.completed_today).length
  const joinDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Explorer'

  return (
    <div className="page pro-cmd">
      <NebulaParticles starCount={100} nebulaCount={4} />
      <div className="pro-scan" aria-hidden="true" />

      {/* Hero Identity Section */}
      <header className="pro-hero">
        <div className="pro-hero-bg" aria-hidden="true">
          <div className="pro-hero-ring r1" />
          <div className="pro-hero-ring r2" />
          <div className="pro-hero-ring r3" />
          <div className="pro-hex-grid" />
        </div>

        <div className="pro-identity">
          <div className="pro-avatar-zone">
            <div className="pro-avatar-glow" />
            <div className="pro-avatar">
              <span className="pro-avatar-letter">{user?.name?.charAt(0) || 'C'}</span>
              <div className="pro-avatar-orbit" aria-hidden="true">
                <span><Code2 size={10} /></span>
                <span><Sparkles size={10} /></span>
                <span><Zap size={10} /></span>
              </div>
            </div>
            <div className="pro-level-badge">
              <Star size={10} />
              <span>LVL {Math.min(99, Math.floor(totalCards / 10) + 1)}</span>
            </div>
          </div>

          <div className="pro-info">
            <span className="pro-tag">&gt; identity.verified</span>
            <h1 className="pro-name">{user?.name || 'Explorer'}</h1>
            <p className="pro-email">{user?.email}</p>
            <div className="pro-badges">
              <span className="pro-badge"><Terminal size={12} /> CodeShelf Learner</span>
              <span className="pro-badge"><Mail size={12} /> Reminder Active</span>
              <span className="pro-badge"><Shield size={12} /> Since {joinDate}</span>
            </div>
          </div>
        </div>

        <div className="pro-streak-beacon">
          <div className="pro-streak-fire">
            <Flame size={24} />
          </div>
          <div>
            <strong>{streak?.current_streak || 0}</strong>
            <span>day streak</span>
          </div>
        </div>
      </header>

      {/* Stats Command Grid */}
      <section className="pro-stats">
        <MetricOrb icon={Flame} label="Current Streak" value={streak?.current_streak || 0} color="var(--orange)" glyph="🔥" />
        <MetricOrb icon={Trophy} label="Longest Streak" value={streak?.longest_streak || 0} color="var(--accent)" glyph="🏆" />
        <MetricOrb icon={Target} label="Cards Today" value={streak?.cards_reviewed_today || 0} color="var(--primary)" glyph="⚡" />
        <MetricOrb icon={Activity} label="Min. Target" value={streak?.minimum_cards || 5} color="var(--blue)" glyph="📡" />
      </section>

      {/* Heatmap Neural Map */}
      <section className="pro-neural-map">
        <div className="pro-neural-head">
          <div>
            <span className="pro-tag">&gt; neural_activity_map</span>
            <h2>Last 60 Days</h2>
            <p className="pro-neural-sub">Memory retention heatmap — each cell is one day of revision</p>
          </div>
          <div className="pro-neural-score">
            <Flame size={18} />
            <strong>{streak?.current_streak || 0}</strong>
            <span>active</span>
          </div>
        </div>

        <ActivityHeatmap activity={activity} minimum={streak?.minimum_cards || 5} />

        <div className="pro-neural-footer">
          <div className="pro-neural-stat">
            <Cpu size={14} />
            <span>{completeDays}/60 complete</span>
          </div>
          <div className="pro-neural-stat">
            <Rocket size={14} />
            <span>{totalCards} cards reviewed</span>
          </div>
          <div className="pro-neural-stat">
            <Target size={14} />
            <span>{totalMistakes} mistakes fixed</span>
          </div>
          <div className="pro-heat-legend">
            <i className="pro-hc l0" />
            <i className="pro-hc l1" />
            <i className="pro-hc l2" />
            <i className="pro-hc l3" />
            <i className="pro-hc l4" />
          </div>
        </div>
      </section>

      {/* Activity Log */}
      <section className="pro-log-panel">
        <div className="pro-log-head">
          <span className="pro-tag">&gt; activity_log</span>
          <h3>Recent Sessions</h3>
        </div>
        <div className="pro-log-list">
          {activity.length ? activity.map((day) => (
            <div className={`pro-log-row ${day.completed_today ? 'complete' : ''}`} key={day.date}>
              <div className="pro-log-pip" />
              <div className="pro-log-date">{day.date}</div>
              <div className="pro-log-stats">
                <span><Zap size={11} /> {day.cards_reviewed} cards</span>
                <span><Target size={11} /> {day.mistakes_fixed} fixes</span>
              </div>
              <div className={`pro-log-badge ${day.completed_today ? 'ok' : 'miss'}`}>
                {day.completed_today ? '● COMPLETE' : '○ PARTIAL'}
              </div>
            </div>
          )) : (
            <div className="pro-log-empty">
              <Globe size={20} />
              <span>No activity data yet — start revising!</span>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions Footer */}
      <footer className="pro-actions">
        <Link to="/revision/today" className="pro-action-btn primary">
          <Rocket size={15} /> Start Revision
        </Link>
        <Link to="/add-note" className="pro-action-btn secondary">
          <Sparkles size={15} /> Add Learning
        </Link>
      </footer>
    </div>
  )
}

function MetricOrb({ icon: Icon, label, value, color, glyph }) {
  return (
    <div className="pro-metric" style={{ '--mc': color }}>
      <div className="pro-metric-glow" />
      <div className="pro-metric-icon"><Icon size={20} /></div>
      <strong>{value}</strong>
      <span>{label}</span>
      <div className="pro-metric-glyph">{glyph}</div>
    </div>
  )
}

function ActivityHeatmap({ activity, minimum }) {
  const byDate = new Map((activity || []).map((day) => [day.date, day]))
  const days = []
  const today = new Date()
  for (let offset = 59; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = date.toISOString().slice(0, 10)
    const item = byDate.get(key) || { date: key, cards_reviewed: 0, mistakes_fixed: 0, completed_today: false }
    days.push(item)
  }

  return (
    <div className="pro-heatmap">
      {days.map((day, i) => {
        const level = day.completed_today ? 4 : Math.min(3, Math.ceil((day.cards_reviewed || 0) / Math.max(1, minimum / 3)))
        return (
          <span
            key={day.date}
            className={`pro-hc l${level}`}
            title={`${day.date}: ${day.cards_reviewed || 0} cards, ${day.mistakes_fixed || 0} mistakes`}
            style={{ animationDelay: `${i * 15}ms` }}
          />
        )
      })}
    </div>
  )
}
