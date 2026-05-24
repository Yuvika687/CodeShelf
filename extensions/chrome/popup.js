const fields = ['apiBase', 'jwt', 'githubToken', 'githubRepo', 'githubBranch']
let capturedProblem = null

const $ = (id) => document.getElementById(id)

init()

async function init() {
  const stored = await chrome.storage.sync.get(fields)
  fields.forEach((field) => {
    if (stored[field]) $(field).value = stored[field]
  })
  if (!$('githubBranch').value) $('githubBranch').value = 'main'
  $('saveSettings').addEventListener('click', saveSettings)
  $('capturePage').addEventListener('click', capturePage)
  $('saveCodeShelf').addEventListener('click', saveCodeShelf)
  $('commitGithub').addEventListener('click', commitGithub)
}

async function saveSettings() {
  const values = Object.fromEntries(fields.map((field) => [field, $(field).value.trim()]))
  await chrome.storage.sync.set(values)
  setStatus('Connection saved.')
}

async function capturePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'CODESHELF_CAPTURE' }).catch(() => null)
  if (!response?.problem) {
    setStatus('Could not capture this page. Open a LeetCode problem tab first.')
    return
  }
  capturedProblem = response.problem
  $('capturePreview').textContent = `${capturedProblem.title}\n${capturedProblem.platform} / ${capturedProblem.difficulty}\n${capturedProblem.code ? 'Code captured' : 'No code detected yet'}`
  setStatus('Captured page.')
}

async function saveCodeShelf() {
  if (!capturedProblem) await capturePage()
  if (!capturedProblem) return
  const apiBase = cleanApiBase($('apiBase').value)
  const jwt = $('jwt').value.trim()
  if (!apiBase || !jwt) {
    setStatus('Add CodeShelf API URL and JWT first.')
    return
  }
  const response = await fetch(`${apiBase}/problems`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(capturedProblem),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    setStatus(data.detail || data.error || 'CodeShelf save failed.')
    return
  }
  capturedProblem.id = data.problem?.id
  setStatus('Saved to CodeShelf.')
}

async function commitGithub() {
  if (!capturedProblem) await capturePage()
  if (!capturedProblem) return
  const token = $('githubToken').value.trim()
  const repo = $('githubRepo').value.trim()
  const branch = $('githubBranch').value.trim() || 'main'
  if (!token || !repo) {
    setStatus('Add GitHub token and repo first.')
    return
  }
  const path = solutionPath(capturedProblem)
  const content = renderMarkdown(capturedProblem)
  await putGithubFile({ token, repo, branch, path, content, message: `CodeShelf: save ${capturedProblem.title}` })
  setStatus(`Committed: ${path}`)
}

async function putGithubFile({ token, repo, branch, path, content, message }) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
  const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers })
  let sha = null
  if (existing.ok) sha = (await existing.json()).sha
  const payload = {
    message,
    branch,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha ? { sha } : {}),
  }
  const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(payload) })
  if (!response.ok) throw new Error(await response.text())
}

function cleanApiBase(value) {
  const clean = value.trim().replace(/\/+$/, '')
  if (!clean) return ''
  return clean.endsWith('/api') ? clean : `${clean}/api`
}

function solutionPath(problem) {
  return `${slug(problem.platform)}/${slug(problem.topic)}/${slug(problem.pattern || 'uncategorized')}/${slug(problem.title)}.md`
}

function renderMarkdown(problem) {
  return `# ${problem.title}

- Platform: ${problem.platform}
- Difficulty: ${problem.difficulty}
- Topic: ${problem.topic}
- Pattern: ${problem.pattern || 'Uncategorized'}
- Source: ${problem.url}

## Approach

${problem.approach || 'Add approach notes in CodeShelf.'}

## Solution

\`\`\`${problem.language || ''}
${problem.code || '// Add solution code'}
\`\`\`
`
}

function slug(value) {
  return String(value || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
}

function setStatus(text) {
  $('status').textContent = text
}
