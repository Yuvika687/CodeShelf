import { Activity, CalendarDays, Flame, Mail, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { activityApi } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PageTitle } from './Upload.jsx'

export default function Profile() {
  const { user } = useAuth()
  const [streak, setStreak] = useState(null)
  const [activity, setActivity] = useState([])

  useEffect(() => {
    activityApi.streak().then(setStreak).catch(() => {})
    activityApi.activity().then((data) => setActivity(data.activity || [])).catch(() => {})
  }, [])

  return (
    <div className="page profile-page">
      <PageTitle title="Profile" subtitle="Your coding memory and revision stats." />
      <section className="card profile-header-card">
        <div className="avatar xl">{user?.name?.charAt(0) || 'C'}</div>
        <div className="profile-copy">
          <h1>{user?.name}</h1>
          <p>{user?.email}</p>
          <div className="profile-meta">
            <span><User size={14} /> CodeShelf learner</span>
            <span><Mail size={14} /> Reminder-ready</span>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <Metric icon={Flame} label="Current Streak" value={streak?.current_streak || 0} />
        <Metric icon={Flame} label="Longest Streak" value={streak?.longest_streak || 0} />
        <Metric icon={Activity} label="Cards Today" value={streak?.cards_reviewed_today || 0} />
        <Metric icon={Activity} label="Minimum Cards" value={streak?.minimum_cards || 5} />
      </div>

      <section className="streak-heatmap-panel">
        <div className="heatmap-head">
          <div>
            <p className="eyebrow">Streak chart</p>
            <h2>Last 60 days</h2>
          </div>
          <div className="heatmap-score">
            <Flame size={18} />
            <strong>{streak?.current_streak || 0}</strong>
            <span>current</span>
          </div>
        </div>
        <ActivityHeatmap activity={activity} minimum={streak?.minimum_cards || 5} />
      </section>

      <section className="card">
        <h2>Recent Activity</h2>
        <div className="list-stack">
          {activity.map((day) => (
            <article className="revision-row" key={day.date}>
              <span>{day.date}</span>
              <small>{day.cards_reviewed} cards | {day.mistakes_fixed} mistakes | {day.completed_today ? 'complete' : 'incomplete'}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value }) {
  return <div className="card metric-card"><Icon size={22} /><strong>{value}</strong><span>{label}</span></div>
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
  const completed = days.filter((day) => day.completed_today).length
  const totalCards = days.reduce((sum, day) => sum + (day.cards_reviewed || 0), 0)

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid" aria-label="Daily revision heatmap">
        {days.map((day) => {
          const level = day.completed_today ? 4 : Math.min(3, Math.ceil((day.cards_reviewed || 0) / Math.max(1, minimum / 3)))
          return (
            <span
              key={day.date}
              className={`heat-cell l${level}`}
              title={`${day.date}: ${day.cards_reviewed || 0} cards, ${day.mistakes_fixed || 0} mistakes`}
            />
          )
        })}
      </div>
      <div className="heatmap-legend">
        <span><CalendarDays size={14} /> {completed}/60 complete days</span>
        <span>{totalCards} cards reviewed</span>
        <div><i className="heat-cell l0" /><i className="heat-cell l1" /><i className="heat-cell l2" /><i className="heat-cell l3" /><i className="heat-cell l4" /></div>
      </div>
    </div>
  )
}
