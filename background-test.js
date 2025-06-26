// Test Badge Notifier - service worker for verifying badge display
const BADGE_COLOR = '#D93025';
const BADGE_TEXT = 'test';

async function displayTestBadge() {
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  await chrome.action.setBadgeText({ text: BADGE_TEXT });
}

chrome.runtime.onInstalled.addListener(displayTestBadge);
chrome.runtime.onStartup.addListener(displayTestBadge);
chrome.action.onClicked.addListener(displayTestBadge);

