export const DEBUG_ENABLED = import.meta.env.VITE_CODESHELF_DEBUG === 'true'

export function debugLog(label, details = {}) {
  if (!DEBUG_ENABLED) return
  console.groupCollapsed(`%c[CodeShelf Debug] ${label}`, 'color:#d6b76a;font-weight:700')
  console.log(details)
  console.groupEnd()
}

export function debugError(label, error, details = {}) {
  if (!DEBUG_ENABLED) return
  console.group(`%c[CodeShelf Error] ${label}`, 'color:#ff6b77;font-weight:800')
  console.error(error)
  if (Object.keys(details).length) console.log(details)
  console.groupEnd()
}

export function redact(value, visible = 8) {
  if (!value) return ''
  const text = String(value)
  if (text.length <= visible * 2) return `${text.slice(0, visible)}...`
  return `${text.slice(0, visible)}...${text.slice(-visible)}`
}

export function responseHeaders(response) {
  const headers = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  return headers
}

export function installGlobalDebugHandlers() {
  if (!DEBUG_ENABLED || window.__codeshelfDebugInstalled) return
  window.__codeshelfDebugInstalled = true

  window.addEventListener('error', (event) => {
    debugError('window.error', event.error || event.message, {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    debugError('window.unhandledrejection', event.reason)
  })

  debugLog('runtime boot', {
    href: window.location.href,
    origin: window.location.origin,
    userAgent: navigator.userAgent,
  })
}
