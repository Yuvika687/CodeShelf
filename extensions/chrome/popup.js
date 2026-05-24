const DEFAULT_API_BASE = 'https://code-shelf-org.onrender.com/api'
const DEFAULT_APP_URL = 'https://code-shelf-org.onrender.com'
const fields = ['apiBase', 'jwt', 'userName', 'userEmail']
let capturedProblem = null

const $ = (id) => document.getElementById(id)

init()

async function init() {
  const stored = await chrome.storage.sync.get(fields)
  if (!stored.apiBase) await chrome.storage.sync.set({ apiBase: DEFAULT_API_BASE })
  setConnectionState(stored)
  $('connectCodeShelf').addEventListener('click', connectCodeShelf)
  $('capturePage').addEventListener('click', capturePage)
  $('saveCodeShelf').addEventListener('click', saveCodeShelf)
}

function setConnectionState(stored) {
  if (stored.jwt) {
    $('connectionState').textContent = `Connected${stored.userEmail ? ` as ${stored.userEmail}` : ''}.`
    $('connectCodeShelf').textContent = 'Reconnect CodeShelf'
    return
  }
  $('connectionState').textContent = 'Connect your CodeShelf account once. No API URL or token paste needed.'
}

async function connectCodeShelf() {
  const url = `${DEFAULT_APP_URL}/extension-connect`
  await chrome.tabs.create({ url })
  setStatus('Opened CodeShelf connect page.')
}

async function capturePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'CODESHELF_CAPTURE' }).catch(() => null)
  if (!response?.problem) {
    setStatus(response?.error || 'Could not capture this page. Open a LeetCode problem tab first.')
    return
  }
  capturedProblem = response.problem
  $('capturePreview').textContent = `${capturedProblem.title}\n${capturedProblem.platform} / ${capturedProblem.difficulty}\n${capturedProblem.code ? 'Code captured' : 'No code detected yet'}`
  setStatus('Captured page.')
}

async function saveCodeShelf() {
  if (!capturedProblem) await capturePage()
  if (!capturedProblem) return
  const stored = await chrome.storage.sync.get(fields)
  const apiBase = cleanApiBase(stored.apiBase || DEFAULT_API_BASE)
  const jwt = stored.jwt || ''
  if (!jwt) {
    setStatus('Connect CodeShelf first.')
    return
  }
  const response = await fetch(`${apiBase}/extension/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(extensionPayload(capturedProblem)),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await chrome.storage.sync.remove(['jwt', 'userName', 'userEmail'])
      setConnectionState({})
      setStatus('Session expired. Connect CodeShelf again.')
      return
    }
    setStatus(readError(data) || 'CodeShelf save failed.')
    return
  }
  capturedProblem.id = data.problem?.id
  const github = data.github || {}
  const action = data.updated ? 'Updated' : 'Saved'
  setStatus(github.synced ? `${action} and synced: ${github.path}` : `${action} in CodeShelf.`)
}

function extensionPayload(problem) {
  return {
    problem_title: problem.title,
    problem_url: problem.url,
    difficulty: problem.difficulty || 'Medium',
    tags: [problem.topic, problem.pattern].filter(Boolean),
    code: problem.code || '',
    language: problem.language || 'cpp',
    notes: problem.notes || '',
    mistake: problem.mistake || '',
    approach: problem.approach || '',
  }
}

function readError(data) {
  if (typeof data.detail === 'string') return data.detail
  if (data.detail?.message) return data.detail.message
  return data.error || ''
}

function cleanApiBase(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '')
  if (!clean) return DEFAULT_API_BASE
  return clean.endsWith('/api') ? clean : `${clean}/api`
}

function setStatus(text) {
  $('status').textContent = text
}
