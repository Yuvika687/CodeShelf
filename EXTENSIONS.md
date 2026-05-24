# CodeShelf Extensions

CodeShelf now includes two installable extension starter packages.

## Chrome: LeetCode Capture

Location: `extensions/chrome`

Install:

1. Download `public/downloads/codeshelf-chrome-extension.zip` or use the folder directly.
2. Extract it.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click "Load unpacked" and select the extracted folder.
6. Open the extension popup and set:
   - CodeShelf API URL
   - CodeShelf JWT
   - GitHub token
   - GitHub repo in `owner/repo` format
   - branch, usually `main`

Use:

1. Open a LeetCode problem page.
2. Click "Capture current page".
3. Click "Save to CodeShelf" to save or update the problem through the backend extension endpoint. If your CodeShelf account has GitHub connected, the backend also syncs it to the selected repo.
4. Click "Commit to GitHub" only if you want the extension to commit directly with the GitHub token stored in the popup.

## VS Code: Local Practice Sync

Location: `extensions/vscode`

Install in development:

1. Open `extensions/vscode` in VS Code.
2. Press `F5`.
3. In the Extension Development Host, run `CodeShelf: Connect`.
4. Open a solution file.
5. Run `CodeShelf: Save Current File`.
6. Run `CodeShelf: Commit Current File to GitHub` if desired.

Packaged download:

- `public/downloads/codeshelf-vscode-extension.zip`

## GitHub Token

Use a fine-grained GitHub token with Contents read/write permission for only the target solutions repo. The repo setting should be in `owner/repo` format.

The extensions do not automate contest pages, submit code, or bypass platform rules. They only save content the user intentionally captures.
