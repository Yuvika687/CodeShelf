import { ArrowLeft, BookOpen, Brain, ChevronDown, ChevronUp, GitBranch, Globe2, MessageSquare, Sigma, Sparkles, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { aiApi, conceptApi, notesApi } from '../api/client.js'

const CARD_TYPE_CONFIG = {
  concept: { label: 'Concept', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  why: { label: 'Why', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  complexity: { label: 'Formula', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  edge_case: { label: 'Edge Case', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  code_recall: { label: 'Code', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  interview: { label: 'Interview', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  recall: { label: 'Recall', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
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
  return TYPE_ORDER.filter((type) => groups[type]).map((type) => ({ type, cards: groups[type] }))
}

function getCardId(card, type, idx) {
  return card.id || `${type}-${idx}`
}

export default function NoteDetail() {
  const { id } = useParams()
  const [note, setNote] = useState(null)
  const [memory, setMemory] = useState(null)
  const [sources, setSources] = useState([])
  const [reconstruction, setReconstruction] = useState(null)
  const [chatTree, setChatTree] = useState([])
  const [selectedParent, setSelectedParent] = useState('')
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [expandedCards, setExpandedCards] = useState({})
  const [expandedLongAnswers, setExpandedLongAnswers] = useState({})
  const [expandedChat, setExpandedChat] = useState({})

  useEffect(() => {
    conceptApi.detail(id)
      .then((data) => {
        setNote(data.note)
        setMemory(data.memory)
        setSources(data.sources || [])
        setReconstruction(data.reconstruction)
        setChatTree(data.chat_tree || [])
      })
      .catch((err) => setError(err.message))
  }, [id])

  const cardGroups = useMemo(() => groupCardsByType(note?.revision_cards || memory?.cards || []), [note, memory])
  const cardCount = cardGroups.reduce((total, group) => total + group.cards.length, 0)
  const memoryScore = Math.min(99, Math.round(((memory?.cards?.length || 0) * 7) + ((memory?.mistakes?.length || 0) * 9) + ((sources?.length || 0) * 8)))

  function toggleAnswer(cardId) {
    setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
  }

  function toggleLongAnswer(cardId) {
    setExpandedLongAnswers((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
  }

  async function refreshConcept() {
    const data = await conceptApi.detail(id)
    setNote(data.note)
    setMemory(data.memory)
    setSources(data.sources || [])
    setReconstruction(data.reconstruction)
    setChatTree(data.chat_tree || [])
  }

  async function generateCards() {
    setStatus('Generating deep recall cards...')
    const data = await notesApi.generateCards(note.id)
    setStatus(`${data.cards.length} cards generated.`)
    await refreshConcept()
  }

  async function researchInternet() {
    setStatus('Fetching compact internet sources...')
    const data = await conceptApi.research(note.id)
    setSources(data.sources || [])
    setStatus(data.fetched ? 'Internet context cached.' : 'Using cached/available sources.')
  }

  async function reconstruct(includeInternet = true) {
    setStatus('Rebuilding the concept from memory...')
    const data = await conceptApi.reconstruct(note.id, { include_internet: includeInternet })
    setReconstruction(data.reconstruction)
    setSources(data.sources || [])
    setStatus(`Reconstruction ready via ${data.reconstruction?.provider || 'local memory'}.`)
  }

  async function explainWalk() {
    const data = await aiApi.explainForWalkMode({ text: note.content, title: note.title, topic: note.topic })
    setQuestion('Explain this while walking')
    setChatTree((items) => [{ id: `walk-${Date.now()}`, question: 'Explain this while walking', answer: data.explanation, sources: [], parent_id: null }, ...items])
  }

  async function askQuestion(event) {
    event.preventDefault()
    if (!question.trim()) return
    setStatus('Growing the chat tree...')
    const data = await conceptApi.chat(note.id, { question, parent_id: selectedParent || null, include_internet: true })
    setChatTree((items) => [data.node, ...items])
    setSelectedParent(data.node.id)
    setQuestion('')
    setStatus('Answer added to the tree.')
  }

  if (error) return <div className="page"><p className="form-error">{error}</p></div>
  if (!note || !memory || !reconstruction) return <div className="page"><p className="muted">Loading concept memory...</p></div>

  return (
    <div className="page concept-page">
      <Link to="/library" className="back-link"><ArrowLeft size={16} /> Back to Library</Link>

      <section className="concept-hero">
        <div className="concept-hero-copy">
          <div className="tags">{[note.topic, note.note_type, note.difficulty, ...(note.tags || [])].map((tag) => <small key={tag}>{tag}</small>)}</div>
          <h1>{note.title}</h1>
          <p>{reconstruction.headline || note.summary || 'Your saved learning, rebuilt into a recall-ready concept.'}</p>
          <div className="concept-actions">
            <button className="btn btn-primary" onClick={() => reconstruct(true)}><Sparkles size={16} /> Rebuild Memory</button>
            <button className="btn btn-secondary" onClick={researchInternet}><Globe2 size={16} /> Fetch Sources</button>
            <button className="btn btn-secondary" onClick={generateCards}><Brain size={16} /> Generate Cards</button>
          </div>
        </div>
        <div className="memory-gauge">
          <span>{memoryScore}</span>
          <strong>memory signal</strong>
          <p>{cardCount} cards · {memory.mistakes?.length || 0} mistakes · {sources.length} sources</p>
        </div>
      </section>

      {status ? <p className="form-success concept-status">{status}</p> : null}

      <div className="concept-grid">
        <main className="concept-main">
          <section className="concept-panel concept-reconstruction">
            <div className="concept-panel-head"><BookOpen size={18} /><h2>Concept Detail</h2></div>
            <h3>Simple recall</h3>
            <p>{reconstruction.simple}</p>
            <h3>Deep memory</h3>
            <p>{reconstruction.deep}</p>
            {reconstruction.code_pattern ? <pre className="code-panel concept-code">{reconstruction.code_pattern}</pre> : null}
          </section>

          <section className="concept-panel">
            <div className="concept-panel-head"><Sigma size={18} /><h2>Formulas, Complexity, Invariants</h2></div>
            <div className="formula-grid">
              {(reconstruction.formulas?.length ? reconstruction.formulas : memory.formulas || []).map((formula, index) => <code key={`${formula}-${index}`}>{formula}</code>)}
              {!(reconstruction.formulas?.length || memory.formulas?.length) ? <p className="muted">No formulas found yet. Add complexity lines or fetch sources.</p> : null}
            </div>
          </section>

          <section className="concept-panel">
            <div className="concept-panel-head"><Zap size={18} /><h2>Mistake Memory</h2></div>
            <div className="mistake-memory-list">
              {(reconstruction.mistake_memory || []).map((item, index) => (
                <article key={`${item.title}-${index}`}>
                  <strong>{item.title}</strong>
                  <p><b>Wrong:</b> {item.wrong || 'Not recorded.'}</p>
                  <p><b>Correct:</b> {item.correct || 'Not recorded.'}</p>
                  <small>{item.prevention}</small>
                </article>
              ))}
              {!reconstruction.mistake_memory?.length ? <p className="muted">No linked mistakes yet. Add one when this concept hurts you once.</p> : null}
            </div>
          </section>

          <section className="concept-panel">
            <div className="concept-panel-head"><Globe2 size={18} /><h2>Internet Context</h2></div>
            <div className="source-list">
              {sources.map((source) => (
                <a href={source.url} target="_blank" rel="noreferrer" key={source.id || source.url}>
                  <strong>{source.title}</strong>
                  <span>{source.summary}</span>
                </a>
              ))}
              {!sources.length ? <p className="muted">Click Fetch Sources to cache lightweight external references with citations.</p> : null}
            </div>
          </section>

          <section className="concept-panel chat-tree-panel">
            <div className="concept-panel-head"><GitBranch size={18} /><h2>Chat Tree</h2></div>
            <form className="chat-tree-form" onSubmit={askQuestion}>
              <textarea className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask: remind me how I learned this, derive formula, show edge cases..." />
              <div className="chat-form-row">
                <select className="input compact" value={selectedParent} onChange={(event) => setSelectedParent(event.target.value)}>
                  <option value="">New branch</option>
                  {chatTree.map((node) => <option key={node.id} value={node.id}>{node.question.slice(0, 52)}</option>)}
                </select>
                <button className="btn btn-primary"><MessageSquare size={16} /> Ask</button>
              </div>
            </form>
            <FlowTree nodes={chatTree} selectedId={selectedParent} onPick={(node) => {
              setSelectedParent(node.id)
              setQuestion(`Continue from: ${node.question}`)
            }} />
            <div className="chat-tree-list">
              {chatTree.map((node) => (
                <ChatNode
                  key={node.id}
                  node={node}
                  expanded={Boolean(expandedChat[node.id])}
                  onToggle={() => setExpandedChat((items) => ({ ...items, [node.id]: !items[node.id] }))}
                  onReply={() => {
                    setSelectedParent(node.id)
                    setQuestion(`Continue from: ${node.question}`)
                  }}
                />
              ))}
              {!chatTree.length ? <p className="muted">Ask one question and CodeShelf will keep the branch here for later recall.</p> : null}
            </div>
          </section>
        </main>

        <aside className="revision-cards-column concept-card-rail">
          <div className="revision-cards-header">
            <h2>Recall Cards</h2>
            <span className="revision-cards-count">{cardCount}</span>
          </div>
          <div className="revision-cards-scroll">
            <button className="walk-inline" onClick={explainWalk}><Sparkles size={15} /> Walk explanation</button>
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
                        const answer = String(card.answer || 'No answer saved.')
                        const isLongAnswer = answer.length > LONG_ANSWER_LENGTH
                        const isReadingMore = Boolean(expandedLongAnswers[cardId])
                        return (
                          <article key={cardId} className="detail-typed-card" style={{ '--card-type-color': cfg.color, animationDelay: `${idx * 0.04}s` }}>
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
                              {isLongAnswer ? <button className="detail-card-read-more" onClick={() => toggleLongAnswer(cardId)}>{isReadingMore ? 'Show less' : 'Read more'}</button> : null}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )
              })
            ) : (
              <p className="muted">No revision cards yet. Generate them to unlock recall mode.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function FlowTree({ nodes, selectedId, onPick }) {
  if (!nodes.length) return null
  const children = new Map()
  nodes.forEach((node) => {
    const key = node.parent_id || 'root'
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(node)
  })
  const roots = children.get('root') || []
  return (
    <div className="flow-tree">
      <div className="flow-root"><GitBranch size={14} /><span>concept</span></div>
      <div className="flow-branches">
        {roots.map((node) => <FlowNode key={node.id} node={node} childrenMap={children} selectedId={selectedId} onPick={onPick} />)}
      </div>
    </div>
  )
}

function FlowNode({ node, childrenMap, selectedId, onPick }) {
  const kids = childrenMap.get(node.id) || []
  return (
    <div className="flow-node-wrap">
      <button type="button" className={`flow-node ${selectedId === node.id ? 'active' : ''}`} onClick={() => onPick(node)}>
        <span>{node.question}</span>
      </button>
      {kids.length ? (
        <div className="flow-children">
          {kids.map((child) => <FlowNode key={child.id} node={child} childrenMap={childrenMap} selectedId={selectedId} onPick={onPick} />)}
        </div>
      ) : null}
    </div>
  )
}

function ChatNode({ node, expanded, onToggle, onReply }) {
  const answer = String(node.answer || '')
  const isLong = answer.length > 420
  return (
    <article className={`chat-node ${node.parent_id ? 'child' : ''} ${expanded ? 'expanded' : ''}`}>
      <div><strong>{node.question}</strong><button type="button" onClick={onReply}>Reply branch</button></div>
      <p>{expanded || !isLong ? answer : `${answer.slice(0, 420).trim()}...`}</p>
      {isLong ? <button type="button" className="chat-expand" onClick={onToggle}>{expanded ? 'Collapse' : 'Read full answer'}</button> : null}
      {node.sources?.length ? <small>{node.sources.length} cited source{node.sources.length === 1 ? '' : 's'}</small> : null}
    </article>
  )
}
