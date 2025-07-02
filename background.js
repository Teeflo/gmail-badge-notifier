// Gmail Badge Notifier - background service worker
// Periodically polls Gmail's Atom feed and updates the badge

// Default badge color
const DEFAULT_BADGE_COLOR = '#D93025';
let lastCounts = {};
let accountUrls = [];

/**
 * Structured logger helper.
 * @param {"info"|"error"} level
 * @param {string} msg
 * @param {object} [data]
 */
function log(level, msg, data = {}) {
  const entry = { time: new Date().toISOString(), level, msg, ...data };
  const fn = level === 'error' ? console.error : console.log;
  fn(entry);
}

const CACHE_TTL = 30000; // 30 seconds
const FETCH_TIMEOUT = 10000;
const cache = new Map();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, credentials: 'include' });
  } finally {
    clearTimeout(id);
  }
}

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

/**
 * Detects logged-in Gmail accounts by probing their Atom feeds.
 * @param {number} max Accounts to probe
 * @returns {Promise<string[]>}
 */
async function detectAccounts(max = 5) {
  const urls = [];
  for (let i = 0; i < max; i++) {
    const url = i === 0
      ? 'https://mail.google.com/mail/feed/atom'
      : `https://mail.google.com/mail/u/${i}/feed/atom`;
    try {
      const resp = await fetchWithTimeout(url);
      if (resp.ok) {
        urls.push(url);
      } else if ([401, 404].includes(resp.status)) {
        break;
      } else {
        log('error', 'Account detection failed', { status: resp.status });
      }
    } catch (e) {
      log('error', 'Account detection error', { error: String(e) });
      break;
    }
  }
  return urls;
}

/**
 * Fetch unread count for a Gmail Atom feed URL.
 * Results are cached for a short period to avoid excessive requests.
 * @param {string} url Feed URL
 * @returns {Promise<{count:number,email:string}>}
 */
async function fetchUnread(url) {
  const cached = cache.get(url);
  const now = Date.now();
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const resp = await fetchWithTimeout(url);
  if (!resp.ok) throw new Error(`bad response ${resp.status}`);
  const text = await resp.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  const count = parseInt(xml.querySelector('fullcount')?.textContent || '0', 10);
  const title = xml.querySelector('title')?.textContent || url;
  const email = title.replace('Inbox for ', '');
  const data = { count, email };
  cache.set(url, { time: now, data });
  return data;
}

async function scheduleAlarm() {
  const { interval, nightStart, nightEnd } = await chrome.storage.sync.get({
    interval: 1,
    nightStart: '22:00',
    nightEnd: '07:00',
  });
  const isNight = isDndActive(nightStart, nightEnd);
  const period = isNight ? Math.max(interval, 5) : interval;
  chrome.alarms.create('checkMail', { periodInMinutes: period });
}

async function ensureOffscreen() {
  if (!chrome.offscreen) return;
  const hasDoc = chrome.offscreen.hasDocument ? await chrome.offscreen.hasDocument() : false;
  if (!hasDoc) {
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
    log('error', 'playSound failed, retrying', { error: String(e) });
    try {
      await delay(500);
      await chrome.runtime.sendMessage({ action: 'play', src });
    } catch (err) {
      log('error', 'playSound final failure', { error: String(err) });
    }
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
    const results = await Promise.all(accountUrls.map((u) => fetchUnread(u).catch((err) => {
      log('error', 'fetchUnread failed', { url: u, error: String(err) });
      return null;
    })));
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
      nightStart: '22:00',
      nightEnd: '07:00',
    });

    const color = dynamicColors ? getDynamicColor(total, badgeColor) : badgeColor;
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeTextColor({ color: textColor });
    await chrome.action.setBadgeText({ text: total > 0 ? String(total) : '' });

    const lastTotal = Object.values(lastCounts).reduce((a, b) => a + b, 0);

    if (total > lastTotal && !isDndActive(dndStart, dndEnd)) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'New Email',
        message: `You have ${total} unread emails.`,
      });
      if (sound !== 'none') {
        const src = sound.startsWith('data:') ? sound : chrome.runtime.getURL(sound);
        playSound(src);
      }
      if (animation === 'pulse') animateBadge(color);
    }
    lastCounts = counts;
    chrome.storage.local.set({ lastCounts: counts });
  } catch (e) {
    await chrome.action.setBadgeText({ text: '' });
    log('error', 'Failed to update unread count', { error: String(e) });
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
