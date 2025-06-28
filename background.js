// Gmail Badge Notifier - background service worker
// Periodically polls Gmail's Atom feed and updates the badge

// Default badge color
const DEFAULT_BADGE_COLOR = '#D93025';
let lastCount = 0;

chrome.storage.local.get({ lastCount: 0 }, (data) => {
  lastCount = data.lastCount;
});
// Interval in minutes for checking
const CHECK_INTERVAL_MINUTES = 1;

async function ensureOffscreen() {
  if (!chrome.offscreen) return;
  const exists = await chrome.offscreen.hasDocument?.();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play notification sounds',
    });
  }
}

async function playSound(src) {
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ action: 'play', src });
  } catch (e) {
    console.error('Failed to play sound', e);
  }
}

/**
 * Updates the badge with the number of unread emails.
 */
async function updateUnreadCount() {
  try {
    const response = await fetch('https://mail.google.com/mail/feed/atom', { credentials: 'include' });
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    const match = text.match(/<fullcount>(\d+)<\/fullcount>/i);
    const count = match ? parseInt(match[1], 10) : NaN;
    if (isNaN(count)) throw new Error('fullcount not found');
    const { badgeColor, sound } = await chrome.storage.sync.get({
      badgeColor: DEFAULT_BADGE_COLOR,
      sound: 'none'
    });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    if (isNaN(count) || count === 0) {
      await chrome.action.setBadgeText({ text: '' });
    } else {
      await chrome.action.setBadgeText({ text: count.toString() });
    }

    if (count > lastCount) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'New Email',
        message: `You have ${count} unread emails.`,
      });
      if (sound !== 'none') {
        const src = sound.startsWith('data:')
          ? sound
          : chrome.runtime.getURL(sound);
        playSound(src);
      }
    }
    lastCount = count;
    chrome.storage.local.set({ lastCount: count });
  } catch (e) {
    // On error (e.g., not signed in), clear the badge
    await chrome.action.setBadgeText({ text: '' });
    console.error('Failed to update unread count:', e);
  }
}

// Create the alarm when the extension is installed or started
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('checkMail', { periodInMinutes: CHECK_INTERVAL_MINUTES });
  updateUnreadCount(); // Immediate check
});

// Update the badge and (re)schedule the alarm when the browser starts
chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create('checkMail', { periodInMinutes: CHECK_INTERVAL_MINUTES });
  updateUnreadCount();
});

// Responds to the periodic alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkMail') {
    updateUnreadCount();
  }
});

// Opens Gmail or activates the existing tab when the icon is clicked
chrome.action.onClicked.addListener(async () => {
  updateUnreadCount();
  const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: 'https://mail.google.com/' });
  }
});
