import { CheckCircle2, PlugZap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getToken } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'

const apiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://code-shelf-org.onrender.com/api'

export default function ExtensionConnect() {
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window) return
      const message = event.data || {}
      if (message.type !== 'CODESHELF_EXTENSION_CONNECTED') return
      setConnected(Boolean(message.ok))
      setStatus(message.ok ? 'CodeShelf Capture is connected. You can close this tab.' : message.error || 'Extension connection failed.')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function connect() {
    const token = getToken()
    if (!token) {
      setStatus('Please log in to CodeShelf first, then try again.')
      return
    }
    setStatus('Connecting extension...')
    window.setTimeout(() => {
      setStatus((current) => current === 'Connecting extension...' ? 'Extension not detected. Open this page from the CodeShelf Capture extension, or reload the unpacked extension in your browser.' : current)
    }, 1600)
    window.postMessage({
      type: 'CODESHELF_CONNECT_EXTENSION',
      token,
      apiBase,
      user: { name: user?.name || '', email: user?.email || '' },
    }, '*')
  }

  return (
    <div className="page extension-connect-page">
      <section className="card extension-connect-card">
        <div className="writing-visual" aria-hidden="true">{connected ? <CheckCircle2 size={42} /> : <PlugZap size={42} />}</div>
        <p className="eyebrow">Browser Extension</p>
        <h1>Connect CodeShelf Capture</h1>
        <p className="muted">Authorize the extension once. After this, it can save LeetCode problems to your CodeShelf account without asking for API URLs or tokens.</p>
        <button className="btn btn-primary" type="button" onClick={connect}>
          <PlugZap size={16} /> Connect Extension
        </button>
        {status ? <p className={connected ? 'form-success' : 'recall-answer'}>{status}</p> : null}
      </section>
    </div>
  )
}
