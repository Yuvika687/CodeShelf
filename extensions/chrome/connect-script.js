window.addEventListener('message', async (event) => {
  if (event.source !== window) return
  const message = event.data || {}
  if (message.type !== 'CODESHELF_CONNECT_EXTENSION') return
  if (!message.token) {
    window.postMessage({ type: 'CODESHELF_EXTENSION_CONNECTED', ok: false, error: 'Missing CodeShelf session.' }, '*')
    return
  }
  await chrome.storage.sync.set({
    jwt: message.token,
    apiBase: message.apiBase || 'https://code-shelf-org.onrender.com/api',
    userName: message.user?.name || '',
    userEmail: message.user?.email || '',
  })
  window.postMessage({ type: 'CODESHELF_EXTENSION_CONNECTED', ok: true }, '*')
})
