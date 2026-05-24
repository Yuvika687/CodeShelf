function textFrom(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector)
    const text = node?.textContent?.trim()
    if (text) return text
  }
  return ''
}

function leetcodeDifficulty() {
  const text = document.body.innerText
  if (/\bHard\b/.test(text)) return 'Hard'
  if (/\bMedium\b/.test(text)) return 'Medium'
  if (/\bEasy\b/.test(text)) return 'Easy'
  return 'Medium'
}

function monacoCode() {
  const textareas = [...document.querySelectorAll('textarea')]
  const focused = textareas.find((node) => node.value && node.value.length > 20)
  if (focused) return focused.value
  const lines = [...document.querySelectorAll('.view-line')]
    .map((line) => line.innerText)
    .filter(Boolean)
  return lines.join('\n')
}

function captureProblem() {
  const title = textFrom([
    '[data-cy="question-title"]',
    'a[href^="/problems/"]',
    'h1',
  ]).replace(/^\d+\.\s*/, '')
  const description = textFrom(['[data-track-load="description_content"]', '.elfjS', '[class*="description"]'])
  const topic = textFrom(['[data-cy="topic-tag"]']) || 'DSA'
  return {
    platform: location.hostname.includes('leetcode') ? 'LeetCode' : location.hostname,
    title: title || document.title.replace(' - LeetCode', ''),
    url: location.href,
    difficulty: leetcodeDifficulty(),
    topic,
    pattern: '',
    status: 'solved',
    approach: description.slice(0, 1600),
    code: monacoCode(),
    language: document.querySelector('[data-e2e-locator="console-language-select"]')?.textContent?.trim() || 'cpp',
    mistake: '',
    time_complexity: '',
    space_complexity: '',
    generate_cards: true,
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'CODESHELF_CAPTURE') return false
  sendResponse({ ok: true, problem: captureProblem() })
  return true
})
