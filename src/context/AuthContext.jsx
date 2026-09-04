import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, getToken, setToken } from '../api/client.js'
import { debugError, debugLog } from '../debug.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    debugLog('auth bootstrap: /me start')
    authApi.me()
      .then((data) => {
        debugLog('auth bootstrap: /me success', { user: data.user })
        setUser(data.user)
      })
      .catch((error) => {
        debugError('auth bootstrap: /me failed', error)
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        debugLog('auth bootstrap: finished')
        setLoading(false)
      })
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    async login(email, password) {
      debugLog('login: start', { email })
      try {
        const data = await authApi.login({ email, password })
        debugLog('login: success', { user: data.user })
        setToken(data.token)
        setUser(data.user)
        return data.user
      } catch (error) {
        debugError('login: failed', error)
        throw error
      }
    },
    async signup(name, email, password) {
      debugLog('signup: start', { name, email })
      try {
        const data = await authApi.signup({ name, email, password })
        debugLog('signup: success', { user: data.user })
        setToken(data.token)
        setUser(data.user)
        return data.user
      } catch (error) {
        debugError('signup: failed', error)
        throw error
      }
    },
    logout() {
      setToken(null)
      setUser(null)
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
