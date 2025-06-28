# Gmail Badge Notifier

## Description
Gmail Badge Notifier is a lightweight Chrome extension that shows the number of unread messages in your Gmail inbox directly on the extension icon.

## Features
- Periodically polls Gmail's Atom feed to determine the number of unread emails.
- Displays this number on a red badge in the Chrome toolbar.
- Sends a desktop notification when new mail arrives.
- Badge and notification colors are configurable from the options page.
- Automatically hides the badge when there are no unread messages.
- Runs in the background using the `chrome.alarms` API from Manifest V3.
- Opens Gmail or activates the existing tab when clicking the extension icon.
- Refreshes the unread count immediately when the icon is clicked.
- Updates the badge automatically when Chrome starts.

## Installation
1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `gmail-badge-notifier` folder.

## How it works
The extension uses a service worker (`background.js`) to poll Gmail's Atom feed (`https://mail.google.com/mail/feed/atom`) every minute. The number of unread messages is extracted from the `<fullcount>` tag. This number is displayed on the extension icon. If the request fails or no message is found, the badge is hidden. To successfully read the feed, you must be signed in to Gmail in Chrome.

## Privacy
This extension only accesses the unread count via the Atom feed. It does not read or store the content of your emails.

## Options
Open the extension options to choose the badge color and notification sound.
