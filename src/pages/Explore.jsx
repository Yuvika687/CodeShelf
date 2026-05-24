import { BookOpen, Code, Database, FileText, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { notesApi } from '../api/client.js'

const filters = ['All', 'Concept Note', 'Problem Note', 'Mistake Note', 'Command Note', 'Interview Note', 'Quick Recall Card']
const iconMap = { SQL: Database, DSA: Code, DevOps: Code }

export default function Explore() {
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [noteType, setNoteType] = useState('')
  const [topic, setTopic] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      notesApi.list({ search, note_type: noteType, topic })
        .then((data) => {
          setNotes(data.notes || [])
          setError('')
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    }, 180)
    return () => clearTimeout(timer)
  }, [search, noteType, topic])

  return (
    <div className="page">
      <PageHeader title="Knowledge Library" subtitle="Structured coding memory: concepts, problems, mistakes, commands, interviews, and quick recall cards." />
      <div className="toolbar">
        <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your memory..." /></label>
        <select className="input compact" value={topic} onChange={(event) => setTopic(event.target.value)}>
          <option value="">All Topics</option><option>DSA</option><option>SQL</option><option>DevOps</option><option>System Design</option><option>JavaScript</option>
        </select>
      </div>
      <Tabs items={filters} active={noteType || 'All'} onChange={(item) => setNoteType(item === 'All' ? '' : item)} />
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading library...</p> : <NoteGrid notes={notes} />}
      {!loading && !notes.length ? <p className="muted empty-state">No notes found. Add learning material to start your revision loop.</p> : null}
    </div>
  )
}

export function PageHeader({ title, subtitle }) {
  return <header className="page-header"><h1>{title}</h1><p>{subtitle}</p></header>
}

export function Tabs({ items, active = 'All', onChange }) {
  return <div className="tabs">{items.map((item) => <button type="button" onClick={() => onChange?.(item)} className={item.toLowerCase() === active.toLowerCase() ? 'active' : ''} key={item}>{item}</button>)}</div>
}

export function NoteGrid({ notes }) {
  return (
    <div className="explore-grid">
      {notes.map((note) => {
        const Icon = iconMap[note.topic] || (note.code_snippet ? Code : FileText)
        return (
          <Link to={`/note/${note.id}`} className="explore-card card" key={note.id} onMouseMove={tiltCard} onMouseLeave={resetTilt}>
            <div className="explore-cover" style={{ '--note-color': topicColor(note.topic) }}><Icon size={36} /></div>
            <div className="explore-card-body">
              <h3>{note.title}</h3>
              <p>{note.summary || note.content?.slice(0, 140)}</p>
              <div className="tags">{[note.topic, note.note_type, ...(note.tags || []).slice(0, 2)].map((tag) => <small key={tag}>{tag}</small>)}</div>
              <footer><span><BookOpen size={12} /> {note.difficulty}</span><span>{new Date(note.updated_at).toLocaleDateString()}</span></footer>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function tiltCard(event) {
  const card = event.currentTarget
  const box = card.getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width - 0.5
  const y = (event.clientY - box.top) / box.height - 0.5
  card.style.transform = `translateY(-4px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg)`
}

function resetTilt(event) {
  event.currentTarget.style.transform = ''
}

function topicColor(topic) {
  if (topic === 'SQL') return '#10b981'
  if (topic === 'DevOps') return '#f59e0b'
  if (topic === 'DSA') return '#8b5cf6'
  return '#3b82f6'
}
