# CodeShelf Chrome Extension

Capture a LeetCode problem page, save or update it in CodeShelf, and optionally commit the captured solution to a GitHub repo.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this `extensions/chrome` folder.

## Connect

1. Click `Connect CodeShelf`.
2. Log in to CodeShelf if needed.
3. Click `Connect Extension`.

`Save to CodeShelf` uses the backend `/api/extension/submit` endpoint. If your CodeShelf account has GitHub connected and a repo selected, the backend syncs the solution automatically.

The extension does not automate contest submissions or scrape contest-only flows.
