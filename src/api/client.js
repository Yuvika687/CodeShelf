import { debugError, debugLog, redact, responseHeaders } from '../debug.js'

const configuredApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const cleanApiBase = configuredApiBase.replace(/\/+$/, '')
const API_BASE = cleanApiBase.endsWith('/api') ? cleanApiBase : `${cleanApiBase}/api`
export const apiBase = API_BASE

debugLog('api config', {
  configuredApiBase,
  normalizedApiBase: API_BASE,
  appOrigin: window.location.origin,
})

export function getToken() {
  return localStorage.getItem('codeshelf_token')
}

export function setToken(token) {
  if (token) {
    debugLog('auth token stored', { tokenPreview: redact(token), length: token.length })
    localStorage.setItem('codeshelf_token', token)
  } else {
    debugLog('auth token cleared')
    localStorage.removeItem('codeshelf_token')
  }
}

export async function api(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const url = `${API_BASE}${path}`
  const method = options.method || 'GET'
  const body = options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  debugLog('api request', {
    method,
    path,
    url,
    hasJwt: Boolean(token),
    headers: { ...headers, Authorization: token ? `Bearer ${redact(token)}` : undefined },
    bodyPreview: body ? redact(body, 24) : '',
  })
  try {
    const startedAt = performance.now()
    const response = await fetch(url, {
      ...options,
      headers,
      body,
    })
    const durationMs = Math.round(performance.now() - startedAt)
    const rawText = await response.text()
    let data = {}
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch (parseError) {
      data = { raw: rawText }
      debugError('api response json parse failed', parseError, { url, rawText })
    }
    debugLog('api response', {
      method,
      path,
      url,
      status: response.status,
      ok: response.ok,
      durationMs,
      headers: responseHeaders(response),
      data,
    })
    if (!response.ok) throw new Error(data.detail || data.error || rawText || 'Something went wrong.')
    return data
  } catch (error) {
    debugError('api fetch failed', error, {
      method,
      path,
      url,
      appOrigin: window.location.origin,
      probableCorsOrNetworkIssue: error instanceof TypeError,
    })
    throw error
  }
}

const q = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const authApi = {
  google: (idToken) => api('/auth/google', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: idToken }),
  me: () => api('/auth/me'),
}

export const dashboardApi = { get: () => api('/dashboard') }

export const notesApi = {
  list: (params) => api(`/notes${q(params)}`),
  get: (id) => api(`/notes/${id}`),
  create: (payload) => api('/notes', { method: 'POST', body: payload }),
  update: (id, payload) => api(`/notes/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => api(`/notes/${id}`, { method: 'DELETE' }),
  generateCards: (id) => api(`/notes/${id}/generate-cards`, { method: 'POST' }),
}

export const problemsApi = {
  list: (params) => api(`/problems${q(params)}`),
  get: (id) => api(`/problems/${id}`),
  create: (payload) => api('/problems', { method: 'POST', body: payload }),
  update: (id, payload) => api(`/problems/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => api(`/problems/${id}`, { method: 'DELETE' }),
}

export const githubApi = {
  status: () => api('/github/status'),
  repos: () => api('/github/repos'),
  setRepo: (payload) => api('/github/set-repo', { method: 'POST', body: payload }),
  disconnect: () => api('/github/disconnect', { method: 'POST' }),
  connectUrl: () => `${API_BASE}/github/connect?token=${encodeURIComponent(getToken() || '')}`,
  saveProblem: (problemId) => api('/github/save-problem', { method: 'POST', body: { problem_id: problemId } }),
}

export const mistakesApi = {
  list: (params) => api(`/mistakes${q(params)}`),
  create: (payload) => api('/mistakes', { method: 'POST', body: payload }),
  update: (id, payload) => api(`/mistakes/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => api(`/mistakes/${id}`, { method: 'DELETE' }),
}

export const revisionApi = {
  today: () => api('/revision/today'),
  createCard: (payload) => api('/revision/cards', { method: 'POST', body: payload }),
  review: (id, rating) => api(`/revision/cards/${id}/review`, { method: 'POST', body: { rating } }),
  walkMode: () => api('/revision/walk-mode'),
  travelPack: () => api('/revision/travel-pack'),
  syncOffline: (reviews) => api('/revision/sync-offline-progress', { method: 'POST', body: { reviews } }),
}

export const emailApi = {
  preferences: () => api('/email/preferences'),
  updatePreferences: (payload) => api('/email/preferences', { method: 'PUT', body: payload }),
  preview: () => api('/email/preview', { method: 'POST' }),
  sendTest: () => api('/email/send-test', { method: 'POST' }),
}

export const conceptApi = {
  detail: (noteId) => api(`/concepts/notes/${noteId}`),
  research: (noteId) => api(`/concepts/notes/${noteId}/research`, { method: 'POST' }),
  reconstruct: (noteId, payload = {}) => api(`/concepts/notes/${noteId}/reconstruct`, { method: 'POST', body: payload }),
  chat: (noteId, payload) => api(`/concepts/notes/${noteId}/chat`, { method: 'POST', body: payload }),
}

export const aiApi = {
  summarizeNote: (payload) => api('/ai/summarize-note', { method: 'POST', body: payload }),
  generateCards: (payload) => api('/ai/generate-cards', { method: 'POST', body: payload }),
  explainForWalkMode: (payload) => api('/ai/explain-for-walk-mode', { method: 'POST', body: payload }),
}

export const activityApi = {
  streak: () => api('/streak'),
  activity: () => api('/activity'),
}
