window.addEventListener('message', async (event) => {
  if (event.source !== window) return
  const message = event.data || {}
  if (message.type !== 'CODESHELF_CONNECT_EXTENSION') return
  if (!message.code) {
    window.postMessage({ type: 'CODESHELF_EXTENSION_CONNECTED', ok: false, error: 'Missing CodeShelf pairing code.' }, window.location.origin)
    return
  }
  const apiBase = message.apiBase || 'https://code-shelf-org.onrender.com/api'
  try {
    const response = await fetch(`${apiBase}/extension/pair-exchange?code=${encodeURIComponent(message.code)}`)
    if (!response.ok) throw new Error('Pairing code exchange failed.')
    const data = await response.json()
    await chrome.storage.sync.set({
      jwt: data.token,
      apiBase,
      userName: data.user?.name || message.user?.name || '',
      userEmail: data.user?.email || message.user?.email || '',
    })
    window.postMessage({ type: 'CODESHELF_EXTENSION_CONNECTED', ok: true }, window.location.origin)
  } catch (error) {
    window.postMessage({ type: 'CODESHELF_EXTENSION_CONNECTED', ok: false, error: 'Pairing failed. Please try again.' }, window.location.origin)
  }
})
