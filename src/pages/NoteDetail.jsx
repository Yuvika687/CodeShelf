import { ArrowLeft, Brain, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { aiApi, notesApi } from '../api/client.js'

const CARD_TYPE_CONFIG = {
  concept:     { label: 'Concept',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  why:         { label: 'Why',         color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  complexity:  { label: 'Complexity',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  edge_case:   { label: 'Edge Case',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  code_recall: { label: 'Code Recall', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  interview:   { label: 'Interview',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  recall:      { label: 'Recall',      color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const TYPE_ORDER = ['concept', 'why', 'complexity', 'edge_case', 'code_recall', 'interview', 'recall']
const LONG_ANSWER_LENGTH = 260

function groupCardsByType(cards) {
  const groups = {}
  for (const card of cards) {
    const type = CARD_TYPE_CONFIG[card.card_type] ? card.card_type : 'recall'
    if (!groups[type]) groups[type] = []
    groups[type].push(card)
  }
  return TYPE_ORDER.filter((t) => groups[t]).map((t) => ({ type: t, cards: groups[t] }))
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function getCardId(card, type, idx) {
  return card.id || `${type}-${idx}`
}

function getDisplayAnswer(card, note) {
  const answer = String(card.answer || '').trim()
  const normalizedAnswer = normalizeText(answer)
  if (!normalizedAnswer) return 'No answer saved for this card.'

  const normalizedSummary = normalizeText(note.summary)
  const normalizedContent = normalizeText(note.content)
  const looksLikeSummary =
    normalizedSummary &&
    (normalizedAnswer === normalizedSummary ||
      (normalizedAnswer.length > 180 && normalizedSummary.includes(normalizedAnswer)) ||
      (normalizedAnswer.length > 180 && normalizedAnswer.includes(normalizedSummary)))

  if (looksLikeSummary || (normalizedContent && normalizedAnswer === normalizedContent)) {
    return 'No concise answer saved for this card.'
  }

  return answer
}

export default function NoteDetail() {
  const { id } = useParams()
  const [note, setNote] = useState(null)
  const [, setStatus] = useState('')
  const [error, setError] = useState('')
  const [expandedCards, setExpandedCards] = useState({})
  const [expandedLongAnswers, setExpandedLongAnswers] = useState({})

  useEffect(() => {
    notesApi.get(id).then((data) => setNote(data.note)).catch((err) => setError(err.message))
  }, [id])

  function toggleAnswer(cardId) {
    setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
  }

  function toggleLongAnswer(cardId) {
    setExpandedLongAnswers((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
  }

  async function generateCards() {
    setStatus('Generating recall cards...')
    const data = await notesApi.generateCards(note.id)
    setStatus(`${data.cards.length} cards generated.`)
    const refreshed = await notesApi.get(note.id)
    setNote(refreshed.note)
  }

  async function explainWalk() {
    const data = await aiApi.explainForWalkMode({ text: note.content, title: note.title, topic: note.topic })
    setStatus(data.explanation)
  }

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!note) return <div className="page"><p className="muted">Loading note...</p></div>

  const cardGroups = groupCardsByType(note.revision_cards || [])
  const cardCount = cardGroups.reduce((total, group) => total + group.cards.length, 0)

  return (
    <div className="page detail-page">
      <Link to="/library" className="back-link"><ArrowLeft size={16} /> Back to Library</Link>
      <div className="detail-grid">
        <main>
          <section className="detail-header">
            <div className="tags">{[note.topic, note.note_type, note.difficulty, ...(note.tags || [])].map((tag) => <small key={tag}>{tag}</small>)}</div>
            <h1>{note.title}</h1>
            <p>{note.summary || 'No summary yet.'}</p>
          </section>
          <article className="markdown card"><MarkdownLite content={note.content} /></article>
          {note.code_snippet ? <pre className="code-panel">{note.code_snippet}</pre> : null}
          <div className="detail-actions detail-actions-bottom">
            <button className="btn btn-primary" onClick={generateCards}><Brain size={16} /> Generate Cards</button>
            <button className="btn btn-secondary" onClick={explainWalk}><Sparkles size={16} /> Explain for Walk Mode</button>
            <Link to={`/edit/${note.id}`} className="btn btn-secondary">Edit</Link>
          </div>
        </main>
        <aside className="revision-cards-column">
          <div className="revision-cards-header">
            <h2>Revision Cards</h2>
            <span className="revision-cards-count">{cardCount}</span>
          </div>
          <div className="revision-cards-scroll">
            {cardGroups.length > 0 ? (
              cardGroups.map(({ type, cards }) => {
                const cfg = CARD_TYPE_CONFIG[type]
                return (
                  <section key={type} className="card-type-group">
                    <h3 className="card-type-group-heading" style={{ color: cfg.color }}>
                      {cfg.label}
                      <span className="card-type-group-count" style={{ color: cfg.color, background: cfg.bg }}>{cards.length}</span>
                    </h3>
                    <div className="card-type-list">
                      {cards.map((card, idx) => {
                        const cardId = getCardId(card, type, idx)
                        const isExpanded = Boolean(expandedCards[cardId])
                        const answer = getDisplayAnswer(card, note)
                        const isLongAnswer = answer.length > LONG_ANSWER_LENGTH
                        const isReadingMore = Boolean(expandedLongAnswers[cardId])
                        return (
                          <article
                            key={cardId}
                            className="detail-typed-card"
                            style={{ '--card-type-color': cfg.color, animationDelay: `${idx * 0.04}s` }}
                          >
                            <div className="detail-typed-card-top">
                              <span className="typed-card-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                              <small className="detail-card-due">Due {card.next_review_date}</small>
                            </div>
                            <p className="detail-card-question">{card.question}</p>
                            <button className="detail-card-toggle" onClick={() => toggleAnswer(cardId)}>
                              {isExpanded ? <><ChevronUp size={14} /> Hide Answer</> : <><ChevronDown size={14} /> Show Answer</>}
                            </button>
                            <div className={`detail-card-answer-wrap ${isExpanded ? 'is-expanded' : ''} ${isReadingMore ? 'is-reading-more' : ''}`}>
                              <p className="detail-card-answer">{answer}</p>
                              {isLongAnswer ? (
                                <button className="detail-card-read-more" onClick={() => toggleLongAnswer(cardId)}>
                                  {isReadingMore ? 'Show less' : 'Read more'}
                                </button>
                              ) : null}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )
              })
            ) : (
              <p className="muted">No revision cards yet. Click "Generate Cards" to create them.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function MarkdownLite({ content }) {
  return String(content || '').split('\n').map((line, index) => {
    if (!line.trim()) return null
    if (line.startsWith('# ')) return <h2 key={index}>{line.slice(2)}</h2>
    if (line.startsWith('## ')) return <h3 key={index}>{line.slice(3)}</h3>
    if (line.startsWith('- ')) return <p className="bullet-line" key={index}>{line.slice(2)}</p>
    return <p key={index}>{line}</p>
  })
}
