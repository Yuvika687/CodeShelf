import * as SecureStore from 'expo-secure-store'

// Point this at your local backend while developing (e.g. http://192.168.1.x:8000/api),
// or leave it on the deployed API for a build you can run on a real device.
export const API_BASE = 'https://codeshelf-vwb9.onrender.com/api'

const TOKEN_KEY = 'codeshelf_token'

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function setToken(token) {
  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  }
}

export async function api(path, options = {}) {
  const token = await getToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const body = options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, body })
  const rawText = await response.text()
  let data = {}
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = { raw: rawText }
  }
  if (!response.ok) throw new Error(data.detail || data.error || rawText || 'Something went wrong.')
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
  login: (email, password) => api('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => api('/auth/me'),
}

export const notesApi = {
  list: (params) => api(`/notes${q(params)}`),
  get: (id) => api(`/notes/${id}`),
}

export const aiApi = {
  summarizeNote: (payload) => api('/ai/summarize-note', { method: 'POST', body: payload }),
}
