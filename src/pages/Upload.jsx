import { Brain, Clipboard, FileJson, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { cpp } from '@codemirror/lang-cpp'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { aiApi, notesApi } from '../api/client.js'

const noteTypes = ['Concept Note', 'Problem Note', 'Mistake Note', 'Command Note', 'Interview Note', 'Quick Recall Card']
const llmPrompt = `You are preparing a CodeShelf learning note. Return only valid JSON with this shape:
{
  "title": "specific title",
  "note_type": "Concept Note | Problem Note | Mistake Note | Command Note | Interview Note | Quick Recall Card",
  "topic": "DSA | SQL | DevOps | System Design | JavaScript | General",
  "subtopic": "specific pattern or subtopic",
  "difficulty": "Easy | Medium | Hard",
  "summary": "120-220 word revision summary",
  "content": "detailed teaching note with definitions, intuition, examples, edge cases, and common mistakes",
  "code_snippet": "optional code or command",
  "language": "cpp | python | javascript | sql | bash | text",
  "source": "where this came from",
  "source_url": "optional URL",
  "tags": ["short", "searchable", "tags"],
  "revision_cards": [
    { "question": "active recall question", "answer": "precise answer" }
  ]
}
Make the content detailed enough for future revision. Do not add markdown fences around the JSON.`

export default function Upload() {
  const navigate = useNavigate()
  const [tags, setTags] = useState(['revision'])
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [importText, setImportText] = useState('')
  const [importHints, setImportHints] = useState([])
  const [form, setForm] = useState({
    title: '',
    content: '',
    note_type: 'Concept Note',
    topic: 'DSA',
    subtopic: '',
    difficulty: 'Medium',
    source: '',
    source_url: '',
    code_snippet: '',
    language: 'cpp',
    summary: '',
    generate_cards: true,
  })

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const addTag = () => {
    const clean = tagInput.trim()
    if (clean && !tags.includes(clean)) setTags([...tags, clean])
    setTagInput('')
  }

  async function summarize() {
    setStatus('Summarizing...')
    const data = await aiApi.summarizeNote({ text: form.content, title: form.title, topic: form.topic })
    update('summary', data.summary)
    setStatus(`Summary generated with ${data.provider}.`)
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(llmPrompt)
    setStatus('CodeShelf LLM prompt copied. Paste the LLM JSON below when it responds.')
  }

  function importFromLlm() {
    setError('')
    const parsed = parseLlmNote(importText)
    if (!parsed) {
      setError('Could not parse the LLM output. Ask the model to return valid JSON only, then paste it again.')
      return
    }
    const cards = Array.isArray(parsed.revision_cards) ? parsed.revision_cards : []
    const cardAppendix = cards.length
      ? `\n\n## Revision Cards\n${cards.map((card, index) => `- Q${index + 1}: ${card.question || ''}\n  A: ${card.answer || ''}`).join('\n')}`
      : ''
    setForm((current) => ({
      ...current,
      title: cleanText(parsed.title) || current.title,
      content: `${cleanText(parsed.content) || current.content}${cardAppendix}`,
      note_type: normalizeChoice(parsed.note_type, noteTypes, current.note_type),
      topic: cleanText(parsed.topic) || current.topic,
      subtopic: cleanText(parsed.subtopic) || current.subtopic,
      difficulty: normalizeChoice(parsed.difficulty, ['Easy', 'Medium', 'Hard'], current.difficulty),
      source: cleanText(parsed.source) || current.source,
      source_url: cleanText(parsed.source_url) || current.source_url,
      code_snippet: cleanText(parsed.code_snippet) || current.code_snippet,
      language: cleanText(parsed.language) || current.language,
      summary: cleanText(parsed.summary) || current.summary,
    }))
    if (Array.isArray(parsed.tags) && parsed.tags.length) {
      setTags([...new Set([...tags, ...parsed.tags.map(cleanText).filter(Boolean)])])
    }
    const hints = qualityHints(parsed, cards)
    setImportHints(hints)
    setStatus(hints.length ? 'Imported with quality suggestions below.' : 'Imported structured note into the form.')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    try {
      const data = await notesApi.create({ ...form, tags })
      navigate(`/note/${data.note.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <PageTitle title="Add Learning Material" subtitle="Capture what you learned, then turn it into future recall." />
      <div className="form-grid">
        <form className="card form-card" onSubmit={handleSubmit}>
          <Field label="Title *"><input className="input" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Container With Most Water pointer rule" /></Field>
          <div className="three-col">
            <Field label="Type"><select className="input" value={form.note_type} onChange={(e) => update('note_type', e.target.value)}>{noteTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
            <Field label="Topic"><input className="input" value={form.topic} onChange={(e) => update('topic', e.target.value)} placeholder="DSA, SQL, DevOps" /></Field>
            <Field label="Difficulty"><select className="input" value={form.difficulty} onChange={(e) => update('difficulty', e.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
          </div>
          <Field label="Subtopic / Pattern"><input className="input" value={form.subtopic} onChange={(e) => update('subtopic', e.target.value)} placeholder="Two pointers, joins, Docker volumes..." /></Field>
          <Field label="Content *">
            <CodeMirror value={form.content} height="280px" theme={vscodeDark} extensions={[javascript({ jsx: true }), python(), sql(), cpp()]} onChange={(val) => update('content', val)} />
          </Field>
          <div className="two-col">
            <Field label="Source"><input className="input" value={form.source} onChange={(e) => update('source', e.target.value)} placeholder="LeetCode, docs, course..." /></Field>
            <Field label="Source URL"><input className="input" value={form.source_url} onChange={(e) => update('source_url', e.target.value)} placeholder="https://..." /></Field>
          </div>
          <div className="two-col">
            <Field label="Language"><input className="input" value={form.language} onChange={(e) => update('language', e.target.value)} /></Field>
            <Field label="Generate cards"><select className="input" value={String(form.generate_cards)} onChange={(e) => update('generate_cards', e.target.value === 'true')}><option value="true">Yes</option><option value="false">No</option></select></Field>
          </div>
          <Field label="Code Snippet"><textarea className="input mono" rows="6" value={form.code_snippet} onChange={(e) => update('code_snippet', e.target.value)} placeholder="Optional code, command, or SQL snippet" /></Field>
          <Field label="Tags">
            <div className="tag-input">
              {tags.map((tag) => <span key={tag}>{tag}<X size={12} onClick={() => setTags(tags.filter((item) => item !== tag))} /></span>)}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag..." />
            </div>
          </Field>
          <Field label="Revision Summary"><textarea className="input" rows="3" value={form.summary} onChange={(e) => update('summary', e.target.value)} /></Field>
          {error ? <p className="form-error">{error}</p> : null}
          {status ? <p className="recall-answer">{status}</p> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={summarize}><Sparkles size={16} /> Summarize</button>
            <button className="btn btn-primary"><Brain size={16} /> Save and Generate Cards</button>
          </div>
        </form>
        <aside className="side-stack">
          <section className="card llm-importer">
            <h3><FileJson size={18} /> LLM Note Importer</h3>
            <p className="muted">Use any LLM to structure raw learning material, then paste the JSON here to fill the form.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary compact" onClick={copyPrompt}><Clipboard size={14} /> Copy Prompt</button>
              <button type="button" className="btn btn-primary compact" onClick={importFromLlm}><Sparkles size={14} /> Import</button>
            </div>
            <textarea className="input mono" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste CodeShelf JSON from ChatGPT, Gemini, DeepSeek, or another LLM..." />
            {importHints.length ? <div className="import-quality">{importHints.map((hint) => <span key={hint}>{hint}</span>)}</div> : null}
          </section>
          <section className="card"><h3>Good Revision Inputs</h3><ul className="check-list"><li>Write the mistake or rule plainly</li><li>Add the exact code or command</li><li>Use topics you want to filter later</li><li>Let cards be generated automatically</li></ul></section>
        </aside>
      </div>
    </div>
  )
}

export function PageTitle({ title, subtitle }) {
  return <header className="page-header"><h1>{title}</h1><p>{subtitle}</p></header>
}

export function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function parseLlmNote(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const unfenced = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const jsonStart = unfenced.indexOf('{')
  const jsonEnd = unfenced.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) return null
  try {
    return JSON.parse(unfenced.slice(jsonStart, jsonEnd + 1))
  } catch {
    return null
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeChoice(value, choices, fallback) {
  const clean = cleanText(value).toLowerCase()
  return choices.find((choice) => choice.toLowerCase() === clean) || fallback
}

function qualityHints(parsed, cards) {
  const hints = []
  if (cleanText(parsed.content).length < 900) hints.push('Content looks short. Ask the LLM for deeper intuition, examples, edge cases, and mistakes.')
  if (cleanText(parsed.summary).split(/\s+/).filter(Boolean).length < 60) hints.push('Summary is thin. Ask for a 120-220 word revision summary.')
  if (!cards.length) hints.push('No revision cards found. Ask for at least 5 active recall cards.')
  if (!cleanText(parsed.code_snippet) && /code|algorithm|query|command/i.test(`${parsed.note_type || ''} ${parsed.topic || ''}`)) hints.push('No code snippet found. Add code if this note needs implementation recall.')
  return hints
}
