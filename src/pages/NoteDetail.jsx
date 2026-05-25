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
  recall:      { label: 'Recall',      color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
}

const TYPE_ORDER = ['concept', 'why', 'complexity', 'edge_case', 'code_recall', 'interview', 'recall']

function groupCardsByType(cards) {
  const groups = {}
  for (const card of cards) {
    const type = CARD_TYPE_CONFIG[card.card_type] ? card.card_type : 'recall'
    if (!groups[type]) groups[type] = []
    groups[type].push(card)
  }
  return TYPE_ORDER.filter((t) => groups[t]).map((t) => ({ type: t, cards: groups[t] }))
}

export default function NoteDetail() {
  const { id } = useParams()
  const [note, setNote] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [expandedCards, setExpandedCards] = useState({})

  useEffect(() => {
    notesApi.get(id).then((data) => setNote(data.note)).catch((err) => setError(err.message))
  }, [id])

  function toggleAnswer(cardId) {
    setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
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

  return (
    <div className="page detail-page">
      <Link to="/library" className="back-link"><ArrowLeft size={16} /> Back to Library</Link>
      <div className="detail-grid">
        <main>
          <section className="detail-header">
            <div className="tags">{[note.topic, note.note_type, note.difficulty, ...(note.tags || [])].map((tag) => <small key={tag}>{tag}</small>)}</div>
            <h1>{note.title}</h1>
            <p>{note.summary || 'No summary yet.'}</p>
            <div className="detail-actions">
              <button className="btn btn-primary" onClick={generateCards}><Brain size={16} /> Generate Cards</button>
              <button className="btn btn-secondary" onClick={explainWalk}><Sparkles size={16} /> Explain for Walk Mode</button>
              <Link to={`/edit/${note.id}`} className="btn btn-secondary">Edit</Link>
            </div>
          </section>
          <article className="markdown card"><MarkdownLite content={note.content} /></article>
          {note.code_snippet ? <pre className="code-panel">{note.code_snippet}</pre> : null}

          {/* Typed revision cards section */}
          {cardGroups.length > 0 && (
            <section className="detail-cards-section">
              <h2>Revision Cards</h2>
              {cardGroups.map(({ type, cards }) => {
                const cfg = CARD_TYPE_CONFIG[type]
                return (
                  <div key={type} className="card-type-group">
                    <h3 className="card-type-group-heading" style={{ color: cfg.color }}>
                      {cfg.label}
                      <span className="card-type-group-count" style={{ color: cfg.color, background: cfg.bg }}>{cards.length}</span>
                    </h3>
                    {cards.map((card, idx) => (
                      <div
                        key={card.id || `${type}-${idx}`}
                        className="detail-typed-card"
                        style={{ borderLeft: `3px solid ${cfg.color}`, animationDelay: `${idx * 0.06}s` }}
                      >
                        <div className="detail-typed-card-top">
                          <span className="typed-card-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                        </div>
                        <p className="detail-card-question">{card.question}</p>
                        <button className="detail-card-toggle" onClick={() => toggleAnswer(card.id || `${type}-${idx}`)}>
                          {expandedCards[card.id || `${type}-${idx}`] ? <><ChevronUp size={14} /> Hide Answer</> : <><ChevronDown size={14} /> Show Answer</>}
                        </button>
                        {expandedCards[card.id || `${type}-${idx}`] && (
                          <div className="detail-card-answer">{card.answer}</div>
                        )}
                        <small className="detail-card-due">Due {card.next_review_date}</small>
                      </div>
                    ))}
                  </div>
                )
              })}
            </section>
          )}
          {!cardGroups.length && <p className="muted" style={{ marginTop: 20 }}>No revision cards yet. Click "Generate Cards" to create them.</p>}
        </main>
        <aside className="detail-rail">
          {status ? <section className="card"><h3>Assistant</h3><p className="muted">{status}</p></section> : null}
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
