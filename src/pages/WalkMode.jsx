import { Eye, Headphones, Mic, Repeat2, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { revisionApi } from '../api/client.js'
import NebulaParticles from '../components/NebulaParticles.jsx'

export default function WalkMode() {
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const card = cards[index]

  useEffect(() => {
    revisionApi.walkMode().then((data) => setCards(data.cards || []))
  }, [])

  function speak(text) {
    window.speechSynthesis?.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.92
    window.speechSynthesis?.speak(u)
  }

  async function rate(rating) {
    if (card) await revisionApi.review(card.id, rating)
    setShowAnswer(false)
    setIndex((c) => Math.min(c + 1, cards.length - 1))
  }

  return (
    <div className="wm-page">
      <NebulaParticles starCount={140} nebulaCount={5} />

      {/* Title area */}
      <div className="wm-header">
        <span className="wm-badge">🎧 Walk Mode • Question {Math.min(index + 1, cards.length)}/{cards.length || 0}</span>
        <h1 className="wm-title">Learn by listening.<br /><span className="wm-accent">Anytime, anywhere.</span></h1>
        <p className="wm-subtitle">Audio-first revision for learning on the go.</p>
      </div>

      {/* Main card */}
      <section className="wm-card">
        {/* Headphones orb */}
        <div className="wm-orb-wrap">
          <div className="wm-wave-bg">
            {Array.from({ length: 48 }).map((_, i) => {
              const center = 24
              const dist = Math.abs(i - center) / center
              const h = Math.max(0.15, 1 - dist * dist)
              return <span key={i} className="wm-wave-bar" style={{ '--h': h, '--delay': `${i * 0.035}s` }} />
            })}
          </div>
          <div className="wm-orb">
            <Headphones size={52} />
            <div className="wm-ring wm-ring-1" />
            <div className="wm-ring wm-ring-2" />
            <div className="wm-ring wm-ring-3" />
          </div>
        </div>

        {/* Question */}
        {card ? (
          <div className="wm-question">
            <small className="wm-q-label">Your question</small>
            <h2>{card.question}</h2>
            <p className="wm-meta">{card.difficulty} • {card.topic}</p>
          </div>
        ) : (
          <div className="wm-question">
            <h2>No walk cards due.</h2>
            <p className="wm-meta">Add notes and generate cards to use Walk Mode</p>
          </div>
        )}

        {showAnswer && card ? <div className="wm-answer"><p>{card.answer}</p></div> : null}

        {/* Actions */}
        <div className="wm-actions">
          <button className="btn btn-secondary wm-btn" onClick={() => speak(`Question ${index + 1}. ${card?.question || ''}`)}><Volume2 size={18} /> Speak</button>
          <button className="btn btn-secondary wm-btn" onClick={() => speak(card?.answer || '')}><Repeat2 size={18} /> Repeat Answer</button>
          <button className="btn btn-secondary wm-btn"><Mic size={18} /> Listen</button>
          <button className="btn btn-primary wm-btn wm-show" onClick={() => setShowAnswer(true)}><Eye size={18} /> Show Answer</button>
        </div>

        {showAnswer && card ? (
          <div className="wm-rating">
            <button className="btn wm-rate-bad" onClick={() => rate('forgot')}>I forgot</button>
            <button className="btn wm-rate-good" onClick={() => rate('good')}>I knew it</button>
          </div>
        ) : null}

        <p className="wm-hint">🎧 Use headphones for the best experience</p>
      </section>
    </div>
  )
}
