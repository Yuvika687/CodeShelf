const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export function getToken() {
  return localStorage.getItem('codeshelf_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('codeshelf_token', token)
  else localStorage.removeItem('codeshelf_token')
}

export async function api(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || data.error || 'Something went wrong.')
  return data
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
  login: (payload) => api('/auth/login', { method: 'POST', body: payload }),
  signup: (payload) => api('/auth/signup', { method: 'POST', body: payload }),
  google: (idToken) => api('/auth/google', { method: 'POST', body: { id_token: idToken } }),
  resendVerification: (email) => api('/auth/resend-verification', { method: 'POST', body: { email } }),
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

export const aiApi = {
  summarizeNote: (payload) => api('/ai/summarize-note', { method: 'POST', body: payload }),
  generateCards: (payload) => api('/ai/generate-cards', { method: 'POST', body: payload }),
  explainForWalkMode: (payload) => api('/ai/explain-for-walk-mode', { method: 'POST', body: payload }),
}

export const activityApi = {
  streak: () => api('/streak'),
  activity: () => api('/activity'),
}
