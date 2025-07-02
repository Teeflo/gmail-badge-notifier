// Gmail Badge Notifier - background service worker
// Periodically polls Gmail's Atom feed and updates the badge

// Default badge color
const DEFAULT_BADGE_COLOR = '#D93025';
let lastCounts = {};
let accountUrls = [];

function getDynamicColor(count, base) {
  if (count >= 16) return '#D93025';
  if (count >= 6) return '#FABB05';
  if (count >= 1) return '#34A853';
  return base;
}

function isDndActive(start, end) {
  if (!start || !end) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const s = sH * 60 + sM;
  const e = eH * 60 + eM;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}


chrome.storage.local.get({ lastCounts: {} }, (data) => {
  lastCounts = data.lastCounts || {};
});

async function detectAccounts() {
  const urls = [];
  for (let i = 0; i < 5; i++) {
    const url = i === 0
      ? 'https://mail.google.com/mail/feed/atom'
      : `https://mail.google.com/mail/u/${i}/feed/atom`;
    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (resp.ok) {
        urls.push(url);
      } else if (resp.status === 401 || resp.status === 404) {
        break;
      }
    } catch (e) {
      break;
    }
  }
  return urls;
}

async function fetchUnread(url) {
  const resp = await fetch(url, { credentials: 'include' });
  if (!resp.ok) throw new Error('bad response');
  const text = await resp.text();
  const cMatch = text.match(/<fullcount>(\d+)<\/fullcount>/i);
  const count = cMatch ? parseInt(cMatch[1], 10) : 0;
  const eMatch = text.match(/Inbox for ([^<]+)</i);
  const email = eMatch ? eMatch[1] : url;
  return { count, email };
}

async function scheduleAlarm() {
  const { interval } = await chrome.storage.sync.get({ interval: 1 });
  const now = new Date();
  let period = interval;
  if (now.getHours() < 9 || now.getHours() >= 18) {
    period = Math.max(interval, 5);
  }
  chrome.alarms.create('checkMail', { periodInMinutes: period });
}

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
async function animateBadge(baseColor) {
  let steps = 0;
  const interval = setInterval(() => {
    const color = steps % 2 ? baseColor : '#ffffff';
    chrome.action.setBadgeBackgroundColor({ color });
    steps += 1;
    if (steps > 6) {
      clearInterval(interval);
      chrome.action.setBadgeBackgroundColor({ color: baseColor });
    }
  }, 300);
}

async function updateAllCounts() {
  try {
    if (accountUrls.length === 0) {
      accountUrls = await detectAccounts();
    }
    const results = await Promise.all(accountUrls.map((u) => fetchUnread(u).catch(() => null)));
    const counts = {};
    let total = 0;
    for (const r of results) {
      if (!r) continue;
      if (!(r.email in counts)) total += r.count;
      counts[r.email] = r.count;
    }
    const {
      badgeColor,
      textColor,
      dynamicColors,
      sound,
      animation,
      dndStart,
      dndEnd,
    } = await chrome.storage.sync.get({
      badgeColor: DEFAULT_BADGE_COLOR,
      textColor: '#ffffff',
      dynamicColors: false,
      sound: 'none',
      animation: 'none',
      dndStart: '',
      dndEnd: '',
    });
    let finalSound = sound;
    if (sound === 'custom') {
      const { customSound } = await chrome.storage.local.get({ customSound: 'none' });
      finalSound = customSound;
    }

    const color = dynamicColors ? getDynamicColor(total, badgeColor) : badgeColor;
    await chrome.action.setBadgeBackgroundColor({ color });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: textColor });
    }
    await chrome.action.setBadgeText({ text: total > 0 ? String(total) : '' });

    const lastTotal = Object.values(lastCounts).reduce((a, b) => a + b, 0);

    if (total > lastTotal && !isDndActive(dndStart, dndEnd)) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'New Email',
        message: `You have ${total} unread emails.`,
      });
      if (finalSound !== 'none') {
        const src = finalSound.startsWith('data:') ? finalSound : chrome.runtime.getURL(finalSound);
        playSound(src);
      }
      if (animation === 'pulse') animateBadge(color);
    }
    lastCounts = counts;
    chrome.storage.local.set({ lastCounts: counts });
  } catch (e) {
    await chrome.action.setBadgeText({ text: '' });
    console.error('Failed to update unread count:', e);
  }
}

// Create the alarm when the extension is installed or started
chrome.runtime.onInstalled.addListener(async () => {
  accountUrls = await detectAccounts();
  await scheduleAlarm();
  updateAllCounts();
});

// Update the badge and (re)schedule the alarm when the browser starts
chrome.runtime.onStartup.addListener(async () => {
  accountUrls = await detectAccounts();
  await scheduleAlarm();
  updateAllCounts();
});

// Responds to the periodic alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkMail') {
    await scheduleAlarm();
    updateAllCounts();
  }
});

// Opens Gmail or activates the existing tab when the icon is clicked
chrome.action.onClicked.addListener(async () => {
  updateAllCounts();
  const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: 'https://mail.google.com/' });
  }
});

// Refresh counts and reschedule alarms when options page saves changes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === 'optionsChanged') {
    detectAccounts().then((urls) => { accountUrls = urls; });
    scheduleAlarm();
    updateAllCounts();
  }
});
