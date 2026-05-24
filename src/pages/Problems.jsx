import { Download, ExternalLink, GitBranch, RefreshCw, Search } from 'lucide-react'
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
  const [github, setGithub] = useState(null)
  const [repos, setRepos] = useState([])
  const [selectedRepo, setSelectedRepo] = useState('')

  useEffect(() => { load() }, [filters])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('github') === 'oauth_missing') {
      setGithubStatus('GitHub OAuth is not configured on the server yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET once, then every user can authorize with one click.')
    } else if (params.get('github') === 'connected') {
      setGithubStatus('GitHub connected. Refresh status, then load repos.')
    }
    refreshGithub()
  }, [])
  const load = () => problemsApi.list(filters).then((data) => setProblems(data.problems || [])).catch((err) => setError(err.message))
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const solved = problems.filter((problem) => problem.status === 'solved').length
  const revisiting = problems.filter((problem) => problem.status === 'revisit').length
  const weak = problems.filter((problem) => problem.status === 'weak').length

  async function submit(event) {
    event.preventDefault()
    setGithubStatus('')
    setError('')
    try {
      const data = await problemsApi.create(form)
      if (github?.connected && github?.repo) {
        try {
          const saved = await githubApi.saveProblem(data.problem.id)
          setGithubStatus(`Committed to GitHub: ${saved.path}`)
        } catch (err) {
          setGithubStatus(`Problem saved in CodeShelf. GitHub sync skipped: ${err.message}`)
        }
      } else {
        setGithubStatus('Problem saved in CodeShelf. Connect GitHub and choose a repo to enable commits.')
      }
      setForm(emptyProblem)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function refreshGithub() {
    try {
      const data = await githubApi.status()
      setGithub(data)
      if (data.repo) setSelectedRepo(data.repo)
    } catch {
      setGithub(null)
    }
  }

  function connectGithub() {
    window.open(githubApi.connectUrl(), '_blank', 'noopener,noreferrer')
    setGithubStatus('GitHub connect opened. After approving, return here and refresh status.')
  }

  async function loadRepos() {
    setGithubStatus('')
    try {
      const data = await githubApi.repos()
      setRepos(data.repos || [])
      setGithubStatus(data.repos?.length ? 'Choose a repo, then save it as the default target.' : 'No pushable repos found for this GitHub account.')
    } catch (err) {
      setGithubStatus(err.message)
    }
  }

  async function saveRepo() {
    if (!selectedRepo) return
    const repo = repos.find((item) => item.full_name === selectedRepo)
    try {
      const data = await githubApi.setRepo({ repo_full_name: selectedRepo, default_branch: repo?.default_branch || github?.branch || 'main' })
      setGithub((current) => ({ ...(current || {}), connected: true, repo: data.repo, branch: data.branch }))
      setGithubStatus(`GitHub target saved: ${data.repo} (${data.branch})`)
    } catch (err) {
      setGithubStatus(err.message)
    }
  }

  return (
    <div className="page problems-page">
      <section className="problem-hero">
        <div><p className="eyebrow">Git-backed practice</p><h1>Problem Tracker</h1><p>Track solved, weak, revisit, and due coding problems with an optional GitHub commit pipeline.</p></div>
        <div className="repo-visual" aria-hidden="true"><GitBranch size={42} /></div>
      </section>
      <div className="problem-stat-strip">
        <span>Total <strong>{problems.length}</strong></span>
        <span>Solved <strong>{solved}</strong></span>
        <span>Revisiting <strong>{revisiting}</strong></span>
        <span>Weak <strong>{weak}</strong></span>
      </div>
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
          <p className="muted">Connect GitHub once, choose a target repo, and CodeShelf will commit intentionally saved problems into organized solution folders.</p>
          <div className="github-status-card">
            <strong>{github?.connected ? `Connected as ${github.github_username || 'GitHub user'}` : 'GitHub not connected'}</strong>
            <span>{github?.repo ? `${github.repo} / ${github.branch || 'main'}` : 'Choose a repo to enable backend commits.'}</span>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary compact" onClick={connectGithub}><ExternalLink size={14} /> Connect</button>
            <button type="button" className="btn btn-secondary compact" onClick={refreshGithub}><RefreshCw size={14} /> Refresh</button>
            <button type="button" className="btn btn-secondary compact" onClick={loadRepos}>Load Repos</button>
          </div>
          {repos.length ? (
            <div className="repo-picker">
              <select className="input" value={selectedRepo} onChange={(event) => setSelectedRepo(event.target.value)}>
                <option value="">Select repo</option>
                {repos.map((repo) => <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>)}
              </select>
              <button type="button" className="btn btn-primary compact" onClick={saveRepo}>Use Repo</button>
            </div>
          ) : null}
          <small>No contest scraping or auto-submit logic is included. The pipeline only commits what you intentionally save.</small>
          <div className="pipeline-steps"><span>Save</span><span>Commit</span><span>Folder</span><span>Repo</span></div>
          <div className="extension-downloads">
            <a className="btn btn-secondary compact" href="/downloads/codeshelf-chrome-extension.zip"><Download size={14} /> Chrome Extension</a>
            <a className="btn btn-secondary compact" href="/downloads/codeshelf-vscode-extension.zip"><Download size={14} /> VS Code Extension</a>
          </div>
        </aside>
        <section className="card">
          <h2>Problems</h2>
          <div className="list-stack">
            {problems.map((problem) => <Link className="revision-row" to={`/problems/${problem.id}`} key={problem.id}><span>{problem.title}</span><small>{problem.topic} / {problem.pattern || 'No pattern'} / {problem.status}</small></Link>)}
            {!problems.length ? <div className="visual-empty"><div className="empty-illustration"><GitBranch size={30} /></div><h3>Track your first coding problem</h3><p>Save solved, weak, and revisit problems with the GitHub commit pipeline.</p></div> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
