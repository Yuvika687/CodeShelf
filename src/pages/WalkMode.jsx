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

  const bars = Array.from({ length: 48 }, (_, i) => {
    const d = Math.abs(i - 24) / 24
    return { h: Math.max(0.12, 1 - d * d), delay: i * 0.032 }
  })

  return (
    <div className="wk">
      <NebulaParticles starCount={120} nebulaCount={4} />

      <div className="wk-top">
        <span className="wk-pill">🎧 Walk Mode • Question {Math.min(index + 1, cards.length)}/{cards.length || 0}</span>
        <h1 className="wk-h1">Learn by listening.<br /><em>Anytime, anywhere.</em></h1>
        <p className="wk-sub">Audio-first revision for learning on the go.</p>
      </div>

      <div className="wk-mid">
        <div className="wk-waves">
          {bars.map((b, i) => <span key={i} className="wk-bar" style={{ '--h': b.h, '--d': `${b.delay}s` }} />)}
        </div>
        <div className="wk-orb">
          <Headphones size={46} />
          <i className="wk-ring r1" />
          <i className="wk-ring r2" />
        </div>
      </div>

      <div className="wk-bottom">
        {card ? (
          <div className="wk-q">
            <small>Your question</small>
            <h2>{card.question}</h2>
            <p>{card.difficulty} • {card.topic}</p>
          </div>
        ) : (
          <div className="wk-q">
            <h2>No walk cards due.</h2>
            <p>Add notes and generate cards to use Walk Mode</p>
          </div>
        )}

        {showAnswer && card ? <div className="wk-ans"><p>{card.answer}</p></div> : null}

        <div className="wk-btns">
          <button className="btn btn-secondary" onClick={() => speak(`Question ${index + 1}. ${card?.question || ''}`)}><Volume2 size={16} /> Speak</button>
          <button className="btn btn-secondary" onClick={() => speak(card?.answer || '')}><Repeat2 size={16} /> Repeat Answer</button>
          <button className="btn btn-secondary"><Mic size={16} /> Listen</button>
          <button className="btn btn-primary wk-show" onClick={() => setShowAnswer(true)}><Eye size={16} /> Show Answer</button>
        </div>

        {showAnswer && card ? (
          <div className="wk-rate">
            <button className="btn wk-forgot" onClick={() => rate('forgot')}>I forgot</button>
            <button className="btn wk-knew" onClick={() => rate('good')}>I knew it</button>
          </div>
        ) : null}

        <small className="wk-hint">🎧 Use headphones for the best experience</small>
      </div>
    </div>
  )
}
