import { Eye, Headphones, Mic, Repeat2, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { revisionApi } from '../api/client.js'

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
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.92
    window.speechSynthesis?.speak(utterance)
  }

  async function rate(rating) {
    if (card) await revisionApi.review(card.id, rating)
    setShowAnswer(false)
    setIndex((current) => Math.min(current + 1, cards.length - 1))
  }

  return (
    <div className="walk-page">
      <section className="walk-card">
        <p className="eyebrow">Walk Mode / Question {Math.min(index + 1, cards.length)}/{cards.length || 0}</p>
        <div className="walk-orb" aria-hidden="true">
          <div className="sound-wave" />
          <Headphones size={70} />
        </div>
        <h1>{card?.question || 'No walk cards due.'}</h1>
        {showAnswer ? <p className="walk-answer">{card.answer}</p> : null}
        <div className="walk-actions">
          <button className="btn btn-secondary" onClick={() => speak(`Question ${index + 1}. ${card?.question || ''}`)}><Volume2 size={18} /> Speak</button>
          <button className="btn btn-secondary" onClick={() => speak(card?.answer || '')}><Repeat2 size={18} /> Repeat Answer</button>
          <button className="btn btn-secondary"><Mic size={18} /> Listen</button>
          <button className="btn btn-primary" onClick={() => setShowAnswer(true)}><Eye size={18} /> Show Answer</button>
        </div>
        {showAnswer ? <div className="walk-rating"><button onClick={() => rate('forgot')}>I forgot</button><button onClick={() => rate('good')}>I knew it</button></div> : null}
      </section>
    </div>
  )
}
