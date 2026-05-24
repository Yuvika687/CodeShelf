# CodeShelf Chrome Extension

Capture a LeetCode problem page, save it to CodeShelf, and optionally commit the captured solution to a GitHub repo.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this `extensions/chrome` folder.

## Connect

1. Enter your CodeShelf API URL, for example `https://your-api.onrender.com/api`.
2. Paste your CodeShelf JWT.
3. For GitHub commits, create a fine-grained token with Contents read/write permission for your target repo.
4. Enter the repo as `owner/repo` and branch as `main`.

The extension does not automate contest submissions or scrape contest-only flows.
