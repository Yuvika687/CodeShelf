import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAYzoiG5XGYQLcYhq4ixBRyF4_l0Gl-1yY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'news-intel-d1bd3.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'news-intel-d1bd3',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'news-intel-d1bd3.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1004594979390',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1004594979390:web:99a622f7544c2e6f3ba76f',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-XQ6EBC8VGS',
}

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
)

export const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null
export const googleProvider = firebaseApp ? new GoogleAuthProvider() : null
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null

export async function loadFirebaseAnalytics() {
  if (!firebaseApp || !firebaseConfig.measurementId) return null
  if (!(await isAnalyticsSupported())) return null
  return getAnalytics(firebaseApp)
}
