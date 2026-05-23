import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { authApi, setToken } from '../api/client.js'
import { debugError, debugLog, redact } from '../debug.js'
import { firebaseAuth, googleProvider } from '../firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    debugLog('auth bootstrap: /me start')
    authApi.me()
      .then((data) => {
        debugLog('auth bootstrap: /me success', { user: data.user })
        setUser(data.user)
      })
      .catch((error) => {
        debugError('auth bootstrap: /me failed', error)
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
    async loginWithGoogle() {
      debugLog('google login: start', {
        hasFirebaseAuth: Boolean(firebaseAuth),
        hasGoogleProvider: Boolean(googleProvider),
        currentOrigin: window.location.origin,
      })
      if (!firebaseAuth || !googleProvider) throw new Error('Google sign-in is not configured for this deployment.')
      try {
        const result = await signInWithPopup(firebaseAuth, googleProvider)
        debugLog('google login: popup success', {
          uid: result.user.uid,
          email: result.user.email,
          emailVerified: result.user.emailVerified,
          providerData: result.user.providerData?.map((provider) => provider.providerId),
        })
        const idToken = await result.user.getIdToken()
        debugLog('google login: firebase id token acquired', {
          tokenPreview: redact(idToken),
          length: idToken.length,
        })
        const data = await authApi.google(idToken)
        debugLog('google login: backend success', { user: data.user, hasJwt: Boolean(data.token) })
        setToken(data.token)
        setUser(data.user)
        return data.user
      } catch (error) {
        debugError('google login: failed', error)
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
