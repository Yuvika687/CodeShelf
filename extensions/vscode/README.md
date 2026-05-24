# CodeShelf VS Code Extension

Save local practice files into CodeShelf and optionally commit the same file to a GitHub repo.

## Install in development

1. Open this `extensions/vscode` folder in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. Run `CodeShelf: Connect` from the command palette.
4. Open a solution file and run `CodeShelf: Save Current File`.
5. Run `CodeShelf: Commit Current File to GitHub` if you want a repo commit too.

## Settings

- `codeshelf.apiBase`: CodeShelf backend API URL.
- `codeshelf.jwt`: CodeShelf JWT token.
- `codeshelf.githubToken`: GitHub token with Contents read/write permission.
- `codeshelf.githubRepo`: target repo in `owner/repo` format.
- `codeshelf.githubBranch`: target branch, usually `main`.

This extension only saves the file you intentionally run the command on. It does not monitor all files or auto-commit contests.
