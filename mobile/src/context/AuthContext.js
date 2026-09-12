import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, getToken, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const token = await getToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const data = await authApi.me()
        setUser(data.user)
      } catch {
        await setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(email, password) {
        const data = await authApi.login(email, password)
        await setToken(data.token)
        setUser(data.user)
        return data.user
      },
      async logout() {
        await setToken(null)
        setUser(null)
      },
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
