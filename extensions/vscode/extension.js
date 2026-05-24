const vscode = require('vscode')

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('codeshelf.connect', connect),
    vscode.commands.registerCommand('codeshelf.saveCurrentFile', saveCurrentFile),
    vscode.commands.registerCommand('codeshelf.commitCurrentFile', commitCurrentFile),
  )
}

async function connect() {
  const config = vscode.workspace.getConfiguration('codeshelf')
  const apiBase = await vscode.window.showInputBox({ prompt: 'CodeShelf API URL', value: config.get('apiBase') })
  const jwt = await vscode.window.showInputBox({ prompt: 'CodeShelf JWT', password: true, value: config.get('jwt') })
  const githubRepo = await vscode.window.showInputBox({ prompt: 'GitHub repo (owner/repo)', value: config.get('githubRepo') })
  const githubToken = await vscode.window.showInputBox({ prompt: 'GitHub token with Contents read/write', password: true, value: config.get('githubToken') })
  const githubBranch = await vscode.window.showInputBox({ prompt: 'GitHub branch', value: config.get('githubBranch') || 'main' })
  if (apiBase !== undefined) await config.update('apiBase', apiBase, vscode.ConfigurationTarget.Global)
  if (jwt !== undefined) await config.update('jwt', jwt, vscode.ConfigurationTarget.Global)
  if (githubRepo !== undefined) await config.update('githubRepo', githubRepo, vscode.ConfigurationTarget.Global)
  if (githubToken !== undefined) await config.update('githubToken', githubToken, vscode.ConfigurationTarget.Global)
  if (githubBranch !== undefined) await config.update('githubBranch', githubBranch || 'main', vscode.ConfigurationTarget.Global)
  vscode.window.showInformationMessage('CodeShelf connection saved.')
}

async function saveCurrentFile() {
  const problem = await currentProblem()
  if (!problem) return
  const config = vscode.workspace.getConfiguration('codeshelf')
  const apiBase = cleanApiBase(config.get('apiBase'))
  const jwt = config.get('jwt')
  if (!apiBase || !jwt) {
    vscode.window.showWarningMessage('Run CodeShelf: Connect first.')
    return
  }
  const response = await fetch(`${apiBase}/problems`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(problem),
  })
  if (!response.ok) {
    vscode.window.showErrorMessage(`CodeShelf save failed: ${await response.text()}`)
    return
  }
  vscode.window.showInformationMessage('Saved current file to CodeShelf.')
}

async function commitCurrentFile() {
  const problem = await currentProblem()
  if (!problem) return
  const config = vscode.workspace.getConfiguration('codeshelf')
  const token = config.get('githubToken')
  const repo = config.get('githubRepo')
  const branch = config.get('githubBranch') || 'main'
  if (!token || !repo) {
    vscode.window.showWarningMessage('Run CodeShelf: Connect and add GitHub token/repo first.')
    return
  }
  const path = solutionPath(problem)
  try {
    await putGithubFile({
      token,
      repo,
      branch,
      path,
      content: renderMarkdown(problem),
      message: `CodeShelf: save ${problem.title}`,
    })
    vscode.window.showInformationMessage(`Committed to GitHub: ${path}`)
  } catch (error) {
    vscode.window.showErrorMessage(`GitHub commit failed: ${error.message}`)
  }
}

async function currentProblem() {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showWarningMessage('Open a practice file first.')
    return null
  }
  const document = editor.document
  const fileName = document.fileName.split(/[\\/]/).pop() || 'practice'
  const title = await vscode.window.showInputBox({ prompt: 'Problem title', value: fileName.replace(/\.[^.]+$/, '') })
  if (!title) return null
  const topic = await vscode.window.showInputBox({ prompt: 'Topic', value: 'DSA' })
  const pattern = await vscode.window.showInputBox({ prompt: 'Pattern/Subtopic', value: '' })
  const difficulty = await vscode.window.showQuickPick(['Easy', 'Medium', 'Hard'], { title: 'Difficulty' }) || 'Medium'
  const status = await vscode.window.showQuickPick(['solved', 'revisit', 'weak', 'not_started'], { title: 'Status' }) || 'solved'
  return {
    platform: 'Local Practice',
    title,
    url: '',
    difficulty,
    topic: topic || 'DSA',
    pattern: pattern || '',
    status,
    approach: 'Saved from local IDE practice.',
    code: document.getText(),
    language: document.languageId || 'text',
    mistake: '',
    time_complexity: '',
    space_complexity: '',
    generate_cards: true,
  }
}

async function putGithubFile({ token, repo, branch, path, content, message }) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'CodeShelf-VSCode',
  }
  const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers })
  let sha = null
  if (existing.ok) sha = (await existing.json()).sha
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message,
      branch,
      content: Buffer.from(content, 'utf8').toString('base64'),
      ...(sha ? { sha } : {}),
    }),
  })
  if (!response.ok) throw new Error(await response.text())
}

function solutionPath(problem) {
  return `${slug(problem.platform)}/${slug(problem.topic)}/${slug(problem.pattern || 'uncategorized')}/${slug(problem.title)}.md`
}

function renderMarkdown(problem) {
  return `# ${problem.title}

- Platform: ${problem.platform}
- Difficulty: ${problem.difficulty}
- Topic: ${problem.topic}
- Pattern: ${problem.pattern || 'Uncategorized'}

## Approach

${problem.approach}

## Solution

\`\`\`${problem.language || ''}
${problem.code || '// Add solution code'}
\`\`\`
`
}

function cleanApiBase(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '')
  if (!clean) return ''
  return clean.endsWith('/api') ? clean : `${clean}/api`
}

function slug(value) {
  return String(value || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
}

function deactivate() {}

module.exports = { activate, deactivate }
