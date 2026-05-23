import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { authApi, setToken } from '../api/client.js'
import { firebaseAuth, googleProvider } from '../firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    async loginWithGoogle() {
      if (!firebaseAuth || !googleProvider) throw new Error('Google sign-in is not configured for this deployment.')
      const result = await signInWithPopup(firebaseAuth, googleProvider)
      const idToken = await result.user.getIdToken()
      const data = await authApi.google(idToken)
      setToken(data.token)
      setUser(data.user)
      return data.user
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
