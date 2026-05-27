import { BookOpen, Brain, CheckCircle2, ChevronRight, Code2, Eye, Flame, Plus, Rocket, RotateCcw, Shield, Sparkles, Target, Terminal, Trophy, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { revisionApi } from '../api/client.js'
import NebulaParticles from '../components/NebulaParticles.jsx'

const ratings = [
  ['forgot', 'Again', '1'],
  ['hard', 'Hard', '2'],
  ['good', 'Good', '3'],
  ['easy', 'Easy', '4'],
]

export default function TodayRevision() {
  const [data, setData] = useState(null)
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [message, setMessage] = useState('')
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => { load() }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (!showAnswer && e.key === ' ') { e.preventDefault(); setShowAnswer(true); return }
      if (showAnswer && ['1','2','3','4'].includes(e.key)) {
        e.preventDefault()
        review(ratings[parseInt(e.key) - 1][0])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const cards = data?.cards || []
  const card = cards[index]
  const progress = useMemo(() => data?.progress || { done: 0, total: cards.length }, [data, cards.length])
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  function load() {
    revisionApi.today().then(setData).catch((err) => setMessage(err.message))
  }

  async function review(rating) {
    if (!card || reviewing) return
    setReviewing(true)
    try {
      const result = await revisionApi.review(card.id, rating)
      setMessage(`✓ Next interval: ${result.card.interval_days} day(s)`)
      setShowAnswer(false)
      setIndex((current) => Math.min(current + 1, cards.length - 1))
      load()
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="rev-cmd">
      <NebulaParticles starCount={90} nebulaCount={3} />
      <div className="rev-scan" aria-hidden="true" />

      {/* Hero Banner */}
      <header className="rev-hero">
        <div className="rev-hero-bg" aria-hidden="true">
          <div className="rev-hero-ring r1" />
          <div className="rev-hero-ring r2" />
        </div>
        <div className="rev-hero-content">
          <span className="rev-tag">&gt; revision_engine.active</span>
          <h1>Today <em>Revision</em></h1>
          <p>A focused mix of due cards, mistakes, commands, and interview recall.</p>
        </div>
        <div className="rev-hero-orb" aria-hidden="true">
          <Brain size={36} />
          <div className="rev-orb-pulse" />
          <div className="rev-orb-ring" />
        </div>
      </header>

      {/* Progress Bar */}
      <section className="rev-progress">
        <div className="rev-progress-head">
          <div className="rev-progress-label">
            <Terminal size={14} />
            <span>Session Progress</span>
          </div>
          <div className="rev-progress-stats">
            <strong>{progress.done}/{progress.total}</strong>
            <span>cards done</span>
          </div>
        </div>
        <div className="rev-progress-track">
          <div className="rev-progress-fill" style={{ width: `${pct}%` }} />
          <div className="rev-progress-glow" style={{ left: `${pct}%` }} />
        </div>
        <div className="rev-progress-footer">
          <span className="rev-pct">{pct}%</span>
          <span className="rev-streak-pill"><Flame size={12} /> {data?.streak?.current || 0} day streak</span>
        </div>
      </section>

      {message && <div className="rev-toast"><CheckCircle2 size={14} /> {message}</div>}

      {/* Flashcard Area */}
      {card ? (
        <section className="rev-stage">
          {/* Card Meta */}
          <div className="rev-card-meta">
            <span className="rev-chip topic">{card.topic}</span>
            <span className="rev-chip type">{card.card_type}</span>
            <span className="rev-chip diff">{card.difficulty}</span>
            <span className="rev-chip counter">
              <Code2 size={11} /> {Math.min(index + 1, cards.length)}/{cards.length}
            </span>
          </div>

          {/* The Flashcard */}
          <div className={`rev-flashcard ${showAnswer ? 'is-flipped' : ''}`}>
            <div className="rev-face rev-front">
              <div className="rev-face-glow" aria-hidden="true" />
              <span className="rev-face-tag">&gt; question</span>
              <h2>{card.question}</h2>
              <button className="rev-reveal-btn" onClick={() => setShowAnswer(true)}>
                <Eye size={16} />
                <span>Reveal Answer</span>
                <kbd>Space</kbd>
              </button>
            </div>
            <div className="rev-face rev-back">
              <div className="rev-face-glow back" aria-hidden="true" />
              <span className="rev-face-tag">&gt; answer</span>
              <div className="rev-answer-block">{card.answer}</div>
            </div>
          </div>

          {/* Rating Buttons */}
          {showAnswer && (
            <div className="rev-rating-grid">
              {ratings.map(([value, label, key]) => (
                <button
                  key={value}
                  className={`rev-rate-btn ${value}`}
                  onClick={() => review(value)}
                  disabled={reviewing}
                >
                  <span className="rev-rate-key">{key}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Keyboard Guide */}
          <div className="rev-keyboard-strip">
            <Terminal size={12} />
            <span>{showAnswer ? 'Press 1-4 to rate' : 'Press Space to reveal'}</span>
          </div>
        </section>
      ) : (
        /* Empty State */
        <section className="rev-empty">
          <div className="rev-empty-orb">
            <CheckCircle2 size={42} />
            <div className="rev-empty-rings" aria-hidden="true" />
          </div>
          <h2>Queue Clear</h2>
          <p>All caught up! Add more notes or problems to grow your revision queue.</p>
          <div className="rev-empty-actions">
            <Link className="rev-action-btn primary" to="/add-note"><Plus size={16} /> Add Note</Link>
            <Link className="rev-action-btn secondary" to="/library"><BookOpen size={16} /> Open Library</Link>
            <button className="rev-action-btn secondary" onClick={load}><RotateCcw size={16} /> Refresh</button>
          </div>
          <div className="rev-suggestions">
            <span><Sparkles size={12} /> Add DSA concept</span>
            <span><Target size={12} /> Log mistake</span>
            <span><Terminal size={12} /> Add SQL command</span>
          </div>
        </section>
      )}

      {/* Weak Topics */}
      {data?.weak_topics?.length ? (
        <section className="rev-weak-panel">
          <div className="rev-weak-head">
            <Shield size={14} />
            <span className="rev-tag">&gt; weak_topics_detected</span>
          </div>
          <div className="rev-weak-chips">
            {data.weak_topics.map((item) => (
              <span className="rev-weak-chip" key={item.topic}>
                <Zap size={11} /> {item.topic}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
