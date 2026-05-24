import { GitBranch, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { githubApi, problemsApi } from '../api/client.js'
import { Field, PageTitle } from './Upload.jsx'

const emptyProblem = { platform: 'LeetCode', title: '', url: '', difficulty: 'Medium', topic: 'DSA', pattern: '', status: 'not_started', approach: '', code: '', language: 'cpp', mistake: '', time_complexity: '', space_complexity: '', generate_cards: true }

export default function Problems() {
  const [problems, setProblems] = useState([])
  const [filters, setFilters] = useState({ topic: '', pattern: '', difficulty: '', status: '' })
  const [form, setForm] = useState(emptyProblem)
  const [error, setError] = useState('')
  const [githubStatus, setGithubStatus] = useState('')

  useEffect(() => { load() }, [filters])
  const load = () => problemsApi.list(filters).then((data) => setProblems(data.problems || [])).catch((err) => setError(err.message))
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event) {
    event.preventDefault()
    setGithubStatus('')
    const data = await problemsApi.create(form)
    try {
      const saved = await githubApi.saveProblem(data.problem.id)
      setGithubStatus(`Committed to GitHub: ${saved.path}`)
    } catch (err) {
      setGithubStatus(`Problem saved in CodeShelf. GitHub sync skipped: ${err.message}`)
    }
    setForm(emptyProblem)
    load()
  }

  return (
    <div className="page">
      <PageTitle title="Problem Tracker" subtitle="Track solved, weak, revisit, and due coding problems." />
      <div className="toolbar">
        <label className="search-field"><Search size={16} /><input value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })} placeholder="Filter topic..." /></label>
        <select className="input compact" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All status</option><option>not_started</option><option>solved</option><option>revisit</option><option>weak</option></select>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="dashboard-grid">
        <section className="card form-card">
          <h2>Add Problem</h2>
          <form onSubmit={submit}>
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => update('title', e.target.value)} /></Field>
            <div className="three-col"><Field label="Platform"><input className="input" value={form.platform} onChange={(e) => update('platform', e.target.value)} /></Field><Field label="Topic"><input className="input" value={form.topic} onChange={(e) => update('topic', e.target.value)} /></Field><Field label="Pattern"><input className="input" value={form.pattern} onChange={(e) => update('pattern', e.target.value)} /></Field></div>
            <div className="three-col">
              <Field label="Difficulty"><select className="input" value={form.difficulty} onChange={(e) => update('difficulty', e.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select></Field>
              <Field label="Status"><select className="input" value={form.status} onChange={(e) => update('status', e.target.value)}><option value="not_started">not_started</option><option value="solved">solved</option><option value="revisit">revisit</option><option value="weak">weak</option></select></Field>
              <Field label="Language"><input className="input" value={form.language} onChange={(e) => update('language', e.target.value)} placeholder="cpp, python, js, sql" /></Field>
            </div>
            <Field label="Source URL"><input className="input" value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="LeetCode, docs, repo, or local practice reference" /></Field>
            <Field label="Approach"><textarea className="input" rows="4" value={form.approach} onChange={(e) => update('approach', e.target.value)} /></Field>
            <Field label="Solution Code"><textarea className="input mono" rows="8" value={form.code} onChange={(e) => update('code', e.target.value)} /></Field>
            <div className="two-col">
              <Field label="Time Complexity"><input className="input" value={form.time_complexity} onChange={(e) => update('time_complexity', e.target.value)} placeholder="O(n)" /></Field>
              <Field label="Space Complexity"><input className="input" value={form.space_complexity} onChange={(e) => update('space_complexity', e.target.value)} placeholder="O(1)" /></Field>
            </div>
            <Field label="Mistake"><textarea className="input" rows="3" value={form.mistake} onChange={(e) => update('mistake', e.target.value)} /></Field>
            {githubStatus ? <p className="recall-answer">{githubStatus}</p> : null}
            <button className="btn btn-primary"><GitBranch size={16} /> Save and Commit Pipeline</button>
          </form>
        </section>
        <aside className="card github-panel">
          <h2><GitBranch size={18} /> GitHub Save Pipeline</h2>
          <p className="muted">Saving a problem now also attempts a backend GitHub commit into platform/topic/pattern folders. Configure the backend with GITHUB_TOKEN, GITHUB_REPO, and GITHUB_BRANCH.</p>
          <small>No contest scraping or auto-submit logic is included. The pipeline only commits what you intentionally save.</small>
        </aside>
        <section className="card">
          <h2>Problems</h2>
          <div className="list-stack">
            {problems.map((problem) => <Link className="revision-row" to={`/problems/${problem.id}`} key={problem.id}><span>{problem.title}</span><small>{problem.topic} / {problem.pattern || 'No pattern'} / {problem.status}</small></Link>)}
            {!problems.length ? <p className="muted">No problems tracked yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
