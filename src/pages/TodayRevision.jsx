import { BookOpen, CheckCircle2, Eye, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { revisionApi } from '../api/client.js'

const ratings = [
  ['forgot', 'Again'],
  ['hard', 'Hard'],
  ['good', 'Good'],
  ['easy', 'Easy'],
]

export default function TodayRevision() {
  const [data, setData] = useState(null)
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])
  const cards = data?.cards || []
  const card = cards[index]
  const progress = useMemo(() => data?.progress || { done: 0, total: cards.length }, [data, cards.length])

  function load() {
    revisionApi.today().then(setData).catch((err) => setMessage(err.message))
  }

  async function review(rating) {
    if (!card) return
    const result = await revisionApi.review(card.id, rating)
    setMessage(`Reviewed. Next interval: ${result.card.interval_days} day(s).`)
    setShowAnswer(false)
    setIndex((current) => Math.min(current + 1, cards.length - 1))
    load()
  }

  return (
    <div className="page revision-page study-session">
      <section className="study-hero">
        <div>
          <p className="eyebrow">Study Session</p>
          <h1>Today Revision</h1>
          <p>A focused mix of due cards, mistakes, commands, and interview recall.</p>
        </div>
        <div className="study-orb" aria-hidden="true"><CheckCircle2 size={36} /></div>
      </section>

      <div className="revision-progress session-progress">
        <strong>{progress.done}/{progress.total} cards done</strong>
        <progress max={progress.total || 1} value={progress.done || 0} />
        <span>Streak: {data?.streak?.current || 0} days</span>
      </div>
      {message ? <p className="recall-answer">{message}</p> : null}
      {card ? (
        <section className="review-card flashcard-stage">
          <div className="tags"><small>{card.topic}</small><small>{card.card_type}</small><small>{card.difficulty}</small></div>
          <div className={`flashcard ${showAnswer ? 'is-flipped' : ''}`}>
            <div className="flashcard-face flashcard-front">
              <p className="eyebrow">Question {Math.min(index + 1, cards.length)} of {cards.length}</p>
              <h2>{card.question}</h2>
              <button className="btn btn-primary" onClick={() => setShowAnswer(true)}><Eye size={16} /> Show Answer</button>
            </div>
            <div className="flashcard-face flashcard-back">
              <p className="eyebrow">Answer</p>
              <p className="answer-block">{card.answer}</p>
            </div>
          </div>
          {showAnswer ? <div className="rating-row">{ratings.map(([value, label]) => <button key={value} className="btn btn-secondary" onClick={() => review(value)}>{label}</button>)}</div> : null}
          <div className="shortcut-strip">Keyboard rhythm: 1 Again / 2 Hard / 3 Good / 4 Easy</div>
        </section>
      ) : (
        <section className="revision-empty visual-empty large-empty">
          <div className="empty-illustration success"><CheckCircle2 size={42} /></div>
          <h2>Nothing due right now</h2>
          <p>Add more notes or problems to grow your future revision queue.</p>
          <div className="form-actions">
            <Link className="btn btn-primary" to="/add-note"><Plus size={16} /> Add Note</Link>
            <Link className="btn btn-secondary" to="/library"><BookOpen size={16} /> Open Library</Link>
            <button className="btn btn-secondary" onClick={load}><RotateCcw size={16} /> Refresh</button>
          </div>
          <div className="next-actions">
            <span>Add DSA concept</span>
            <span>Log mistake</span>
            <span>Add SQL command</span>
          </div>
        </section>
      )}
      {data?.weak_topics?.length ? <section className="bento-panel"><h3>Weak topics found today</h3><div className="topic-chip-row">{data.weak_topics.map((item) => <span className="topic-chip" key={item.topic}>{item.topic}</span>)}</div></section> : null}
    </div>
  )
}
