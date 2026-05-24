# CodeShelf Chrome Extension

Capture a LeetCode problem page, save or update it in CodeShelf, and optionally commit the captured solution to a GitHub repo.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this `extensions/chrome` folder.

## Connect

1. Enter your CodeShelf API URL, for example `https://your-api.onrender.com/api`.
2. Paste your CodeShelf JWT.
3. For GitHub commits, create a fine-grained token with Contents read/write permission for your target repo.
4. Enter the repo as `owner/repo` and branch as `main` only if you want direct extension commits.

`Save to CodeShelf` uses the backend `/api/extension/submit` endpoint. If your CodeShelf account has GitHub connected and a repo selected, the backend syncs the solution automatically. `Commit to GitHub` is the manual token-based fallback from the popup.

The extension does not automate contest submissions or scrape contest-only flows.
