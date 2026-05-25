import { Brain, Check, Clipboard, Edit3, FileJson, LoaderCircle, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { cpp } from '@codemirror/lang-cpp'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { aiApi, notesApi } from '../api/client.js'

const noteTypes = ['Concept Note', 'Problem Note', 'Mistake Note', 'Command Note', 'Interview Note', 'Quick Recall Card']

const CARD_TYPE_CONFIG = {
  concept:     { label: 'Concept',     color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  why:         { label: 'Why',         color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  complexity:  { label: 'Complexity',  color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  edge_case:   { label: 'Edge Case',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  code_recall: { label: 'Code Recall', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  interview:   { label: 'Interview',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
}

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
    { "question": "active recall question", "answer": "precise answer", "card_type": "concept | why | complexity | edge_case | code_recall | interview" }
  ]
}
Make the content detailed enough for future revision. Do not add markdown fences around the JSON.
Important: code_snippet must be a valid JSON string. Escape inner double quotes, backslashes, and newlines. For regex, write \\\\d as \\\\\\\\d.`

export default function Upload() {
  const navigate = useNavigate()
  const [tags, setTags] = useState(['revision'])
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [importText, setImportText] = useState('')
  const [importHints, setImportHints] = useState([])
  const [importedCards, setImportedCards] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryVisible, setSummaryVisible] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [cardError, setCardError] = useState('')
  const summaryRef = useRef(null)
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

  const update = useCallback((key, value) => setForm((current) => ({ ...current, [key]: value })), [])
  const addTag = () => {
    const clean = tagInput.trim()
    if (clean && !tags.includes(clean)) setTags([...tags, clean])
    setTagInput('')
  }

  function updateCard(index, field, value) {
    setImportedCards((prev) => prev.map((card, i) => (i === index ? { ...card, [field]: value } : card)))
  }

  function deleteCard(index) {
    setImportedCards((prev) => prev.filter((_, i) => i !== index))
  }

  async function summarize() {
    setError('')
    setIsSummarizing(true)
    setSummaryVisible(false)
    update('summary', '')
    setStatus('Summarizing...')
    try {
      const data = await aiApi.summarizeNote({ text: form.content, title: form.title, topic: form.topic })
      update('summary', data.summary)
      requestAnimationFrame(() => setSummaryVisible(true))
      setStatus(`Summary generated with ${providerLabel(data.provider)}.`)
    } catch (err) {
      setSummaryVisible(true)
      setError(err.message)
      setStatus('')
    } finally {
      setIsSummarizing(false)
    }
  }

  async function generateAiCardsForForm(noteForm) {
    const text = [noteForm.summary, noteForm.content, noteForm.code_snippet].filter(Boolean).join('\n\n')
    const data = await aiApi.generateCards({ text, title: noteForm.title, topic: noteForm.topic })
    const cards = normalizeCards(data.cards)
    if (!cards.length) return { cards: [], provider: data.provider || 'fallback' }
    return { cards, provider: data.provider || 'gemini' }
  }

  async function generateAiPreview() {
    setError('')
    setCardError('')
    setIsGenerating(true)
    setStatus('Generating 6 typed revision cards with Gemini...')
    try {
      const result = await generateAiCardsForForm(form)
      if (!result.cards.length) {
        setCardError('Gemini could not generate cards. Check your content or try again.')
        setStatus('')
      } else {
        setImportedCards(result.cards)
        setStatus(`${result.cards.length} revision card${result.cards.length === 1 ? '' : 's'} generated with ${providerLabel(result.provider)}.`)
      }
    } catch (err) {
      setCardError(err.message || 'Failed to generate cards. Please try again.')
      setStatus('')
    } finally {
      setIsGenerating(false)
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(llmPrompt)
    setStatus('CodeShelf LLM prompt copied. Paste the LLM JSON below when it responds.')
  }

  function importFromLlm() {
    setError('')
    setImportedCards([])
    const parsed = parseLlmNote(importText)
    if (!parsed) {
      setError(importParseMessage(importText))
      return
    }
    const cards = Array.isArray(parsed.revision_cards) ? parsed.revision_cards : []
    const cleanCards = cards
      .map((card) => ({ question: cleanText(card.question), answer: cleanText(card.answer), card_type: cleanText(card.card_type) || 'recall' }))
      .filter((card) => card.question && card.answer)
    setForm((current) => ({
      ...current,
      title: cleanText(parsed.title) || current.title,
      content: cleanText(parsed.content) || current.content,
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
    setImportedCards(cleanCards)
    if (Array.isArray(parsed.tags) && parsed.tags.length) {
      setTags([...new Set([...tags, ...parsed.tags.map(cleanText).filter(Boolean)])])
    }
    const hints = qualityHints(parsed, cards)
    setImportHints(hints)
    setStatus(hints.length ? `Imported ${cleanCards.length} card${cleanCards.length === 1 ? '' : 's'} with quality suggestions below.` : `Imported structured note with ${cleanCards.length} revision card${cleanCards.length === 1 ? '' : 's'}.`)
  }

  async function handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault()
    setError('')
    setIsSaving(true)
    setStatus('Preparing note...')
    try {
      let noteForm = { ...form }
      let cardsToSave = importedCards
      if (!noteForm.summary.trim() && noteForm.content.trim()) {
        setStatus('Summarizing with AI...')
        const summaryData = await aiApi.summarizeNote({ text: noteForm.content, title: noteForm.title, topic: noteForm.topic })
        noteForm = { ...noteForm, summary: summaryData.summary || noteForm.summary }
        setForm(noteForm)
      }
      if (noteForm.generate_cards && !cardsToSave.length) {
        setStatus('Generating revision cards with Gemini...')
        const generated = await generateAiCardsForForm(noteForm)
        cardsToSave = generated.cards
        setImportedCards(cardsToSave)
        setStatus(`${cardsToSave.length} revision card${cardsToSave.length === 1 ? '' : 's'} ready from ${providerLabel(generated.provider)}. Saving note...`)
      }
      const data = await notesApi.create({ ...noteForm, tags, revision_cards: cardsToSave })
      navigate(`/note/${data.note.id}`)
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page add-note-page">
      <section className="writing-hero"><div><p className="eyebrow">Writing studio</p><h1>Add Learning Material</h1><p>Capture what you learned, then turn it into future recall.</p></div><div className="writing-visual" aria-hidden="true"><Brain size={38} /></div></section>
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
            <div className="editor-shell">
              <div className="editor-toolbar"><span>{form.language || 'text'}</span><span>Format</span><span>{form.content.length} chars</span></div>
              <CodeMirror value={form.content} height="280px" theme={vscodeDark} extensions={[javascript({ jsx: true }), python(), sql(), cpp()]} onChange={(val) => update('content', val)} />
            </div>
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
          <Field label="Revision Summary">
            <div className="summary-field-wrap">
              {isSummarizing && !form.summary ? (
                <div className="summary-skeleton">
                  <div className="skeleton-line" style={{ width: '92%' }} />
                  <div className="skeleton-line" style={{ width: '78%' }} />
                  <div className="skeleton-line" style={{ width: '85%' }} />
                </div>
              ) : (
                <textarea
                  ref={summaryRef}
                  className="input summary-textarea"
                  rows="3"
                  value={form.summary}
                  onChange={(e) => update('summary', e.target.value)}
                  style={{ opacity: summaryVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}
                />
              )}
            </div>
          </Field>
          {error ? <p className="form-error">{error}</p> : null}
          {status ? <p className="recall-answer">{status}</p> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={summarize} disabled={isSummarizing || isSaving}>{isSummarizing ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />} {isSummarizing ? 'Summarizing...' : 'Summarize'}</button>
            <button className="btn btn-primary" disabled={isSaving}>{isSaving ? <LoaderCircle size={16} /> : <Brain size={16} />} Save and Generate Cards</button>
          </div>
        </form>
        <aside className="side-stack assistant-rail">
          <section className="assistant-orb-panel"><Sparkles size={24} /><h3>AI Card Preview</h3><p>Generate 6 typed revision cards through Gemini — concept, why, complexity, edge cases, code recall, and interview.</p></section>
          <section className="card llm-importer">
            <h3><FileJson size={18} /> AI Card Builder</h3>
            <p className="muted">Use CodeShelf AI directly, or paste JSON only when importing from another model.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary compact" onClick={copyPrompt}><Clipboard size={14} /> Copy Prompt</button>
              <button type="button" className="btn btn-primary compact" onClick={importFromLlm}><Sparkles size={14} /> Import</button>
            </div>
            <textarea className="input mono" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste CodeShelf JSON from ChatGPT, Gemini, DeepSeek, or another LLM..." />
            {cardError ? <div className="card-error-toast"><X size={14} onClick={() => setCardError('')} style={{ cursor: 'pointer', flexShrink: 0 }} /><span>{cardError}</span></div> : null}
            {importHints.length ? <div className="import-quality">{importHints.map((hint) => <span key={hint}>{hint}</span>)}</div> : null}
          </section>

          {importedCards.length > 0 && (
            <section className="card typed-cards-panel">
              <div className="typed-cards-header">
                <h3><Edit3 size={16} /> {importedCards.length} Revision Cards</h3>
                <button
                  type="button"
                  className="btn btn-primary compact"
                  disabled={isSaving}
                  onClick={handleSubmit}
                  style={{ fontSize: '0.82rem' }}
                >
                  {isSaving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} Save All Cards
                </button>
              </div>
              <div className="typed-cards-list">
                {importedCards.map((card, idx) => {
                  const cfg = CARD_TYPE_CONFIG[card.card_type] || CARD_TYPE_CONFIG.concept
                  return (
                    <div key={idx} className="typed-card" style={{ borderLeft: `3px solid ${cfg.color}` }}>
                      <div className="typed-card-top">
                        <span className="typed-card-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                        <button type="button" className="typed-card-delete" onClick={() => deleteCard(idx)} title="Remove card"><Trash2 size={14} /></button>
                      </div>
                      <label className="typed-card-field">
                        <span style={{ color: cfg.color, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Question</span>
                        <textarea className="input" rows={2} value={card.question} onChange={(e) => updateCard(idx, 'question', e.target.value)} />
                      </label>
                      <label className="typed-card-field">
                        <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Answer</span>
                        <textarea className="input mono" rows={card.card_type === 'code_recall' ? 5 : 3} value={card.answer} onChange={(e) => updateCard(idx, 'answer', e.target.value)} />
                      </label>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

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
  const jsonText = unfenced.slice(jsonStart, jsonEnd + 1)
  try {
    return JSON.parse(jsonText)
  } catch {
    try {
      return JSON.parse(repairJsonText(jsonText))
    } catch {
      return parseLooseCodeShelfNote(jsonText)
    }
  }
}

function importParseMessage(raw) {
  const text = String(raw || '').trim()
  if (!text) return 'Paste the actual JSON response from the model first.'
  const unfenced = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const jsonStart = unfenced.indexOf('{')
  const jsonEnd = unfenced.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < jsonStart) return 'Could not find a JSON object. Paste the model response that starts with { and ends with }.'
  const jsonText = unfenced.slice(jsonStart, jsonEnd + 1)
  try {
    JSON.parse(jsonText)
  } catch (err) {
    try {
      JSON.parse(repairJsonText(jsonText))
      return 'The JSON needed small repairs. Try Import again, or paste the learning text into Content and use Generate Cards.'
    } catch {
      // Fall through to the specific error hints below.
    }
    const hasCodeSnippet = /"code_snippet"\s*:\s*"/.test(unfenced)
    const hasPythonStringQuotes = /"code_snippet"\s*:\s*"[\s\S]*(?:documents\s*=\s*\[|print\(|def\s+\w+|import\s+\w+)[\s\S]*"\w|\\"/.test(unfenced)
    const hasBadBackslash = /"code_snippet"\s*:\s*"[\s\S]*\\[A-Za-z]/.test(unfenced)
    if (hasCodeSnippet && (hasPythonStringQuotes || hasBadBackslash)) {
      return 'This output is not valid JSON because code_snippet contains raw code. Inner quotes like "text" must be escaped as \\"text\\", and backslashes like \\d must be escaped as \\\\d. The easier path is to paste the learning text into Content and use Generate Cards.'
    }
    return `Could not parse that JSON: ${err.message}`
  }
  return 'Could not parse that text. Paste the actual JSON response from the model, not the prompt.'
}

function repairJsonText(jsonText) {
  let output = ''
  let inString = false
  let escaped = false
  for (const char of jsonText) {
    if (!inString) {
      output += char
      if (char === '"') inString = true
      continue
    }
    if (escaped) {
      output += /["\\/bfnrtu]/.test(char) ? char : `\\${char}`
      escaped = false
      continue
    }
    if (char === '\\') {
      output += char
      escaped = true
      continue
    }
    if (char === '"') {
      output += char
      inString = false
      continue
    }
    if (char === '\n') {
      output += '\\n'
    } else if (char === '\r') {
      output += '\\r'
    } else if (char === '\t') {
      output += '\\t'
    } else {
      output += char
    }
  }
  return output
}

function parseLooseCodeShelfNote(jsonText) {
  const stringKeys = ['title', 'note_type', 'topic', 'subtopic', 'difficulty', 'summary', 'content', 'code_snippet', 'language', 'source', 'source_url']
  const parsed = {}
  stringKeys.forEach((key, index) => {
    parsed[key] = extractLooseString(jsonText, key, [...stringKeys.slice(index + 1), 'tags', 'revision_cards'])
  })
  parsed.tags = parseLooseArray(jsonText, 'tags').map(cleanText).filter(Boolean)
  parsed.revision_cards = normalizeCards(parseLooseArray(jsonText, 'revision_cards'))
  return parsed.title || parsed.content || parsed.code_snippet || parsed.revision_cards.length ? parsed : null
}

function extractLooseString(text, key, nextKeys) {
  const startMatch = new RegExp(`"${key}"\\s*:\\s*"`).exec(text)
  if (!startMatch) return ''
  const start = startMatch.index + startMatch[0].length
  let end = -1
  nextKeys.forEach((nextKey) => {
    const marker = new RegExp(`"\\s*,\\s*"${nextKey}"\\s*:`, 'g')
    marker.lastIndex = start
    const match = marker.exec(text)
    if (match && (end < 0 || match.index < end)) end = match.index
  })
  if (end < 0) return ''
  return decodeLooseString(text.slice(start, end))
}

function parseLooseArray(text, key) {
  const keyMatch = new RegExp(`"${key}"\\s*:`).exec(text)
  if (!keyMatch) return []
  const start = text.indexOf('[', keyMatch.index + keyMatch[0].length)
  if (start < 0) return []
  const end = findArrayEnd(text, start)
  if (end < 0) return []
  const arrayText = text.slice(start, end + 1)
  try {
    return JSON.parse(arrayText)
  } catch {
    try {
      return JSON.parse(repairJsonText(arrayText))
    } catch {
      if (key === 'tags') return [...arrayText.matchAll(/"([^"]+)"/g)].map((match) => decodeLooseString(match[1]))
      return []
    }
  }
}

function findArrayEnd(text, start) {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
    } else if (char === '[') {
      depth += 1
    } else if (char === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function decodeLooseString(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCards(cards) {
  return Array.isArray(cards)
    ? cards
      .map((card) => ({ question: cleanText(card.question), answer: cleanText(card.answer), card_type: cleanText(card.card_type) || 'recall' }))
      .filter((card) => card.question && card.answer)
    : []
}

function normalizeChoice(value, choices, fallback) {
  const clean = cleanText(value).toLowerCase()
  return choices.find((choice) => choice.toLowerCase() === clean) || fallback
}

function providerLabel(provider) {
  const labels = {
    gemini: 'Gemini',
    'gemini-ready-fallback': 'local fallback',
    'huggingface-space': 'Hugging Face Space',
    'huggingface-bart': 'Hugging Face BART',
    fallback: 'local fallback',
  }
  return labels[provider] || provider || 'AI'
}

function qualityHints(parsed, cards) {
  const hints = []
  if (cleanText(parsed.content).length < 900) hints.push('Content looks short. Ask the LLM for deeper intuition, examples, edge cases, and mistakes.')
  if (cleanText(parsed.summary).split(/\s+/).filter(Boolean).length < 60) hints.push('Summary is thin. Ask for a 120-220 word revision summary.')
  if (!cards.length) hints.push('No revision cards found. Ask for at least 5 active recall cards.')
  if (!cleanText(parsed.code_snippet) && /code|algorithm|query|command/i.test(`${parsed.note_type || ''} ${parsed.topic || ''}`)) hints.push('No code snippet found. Add code if this note needs implementation recall.')
  return hints
}
