// Gmail Badge Notifier - background service worker
// Periodically polls Gmail's Atom feed and updates the badge

// Default badge color
const DEFAULT_BADGE_COLOR = '#D93025';
let lastCounts = {};
let accountUrls = [];
let baseIconBitmap;

async function loadBaseIcon() {
  if (!baseIconBitmap) {
    const resp = await fetch(chrome.runtime.getURL('icons/icon128.png'));
    const blob = await resp.blob();
    baseIconBitmap = await createImageBitmap(blob);
  }
  return baseIconBitmap;
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

async function drawBadgeIcon(count, color, shape) {
  const base = await loadBaseIcon();

  function render(size) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(base, 0, 0, size, size);

    if (count > 0) {
      const margin = size * 0.02;
      const w = size * 0.6;
      const h = w;
      const x = size - w - margin;
      const y = margin;
      ctx.fillStyle = color;
      if (shape === 'round') {
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === 'square') {
        ctx.fillRect(x, y, w, h);
      } else if (shape === 'hex') {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = w / 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i + Math.PI / 6;
          const px = cx + r * Math.cos(angle);
          const py = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), x + w / 2, y + h / 2);
    }

    return ctx.getImageData(0, 0, size, size);
  }

  const images = {
    16: render(16),
    32: render(32),
    48: render(48),
    128: render(128),
  };

  const resolved = {};
  for (const [size, data] of Object.entries(images)) {
    resolved[size] = await data;
  }

  await chrome.action.setIcon({ imageData: resolved });
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
      dynamicColors,
      badgeShape,
      sound,
      animation,
      dndStart,
      dndEnd,
    } = await chrome.storage.sync.get({
      badgeColor: DEFAULT_BADGE_COLOR,
      dynamicColors: false,
      badgeShape: 'round',
      sound: 'none',
      animation: 'none',
      dndStart: '',
      dndEnd: '',
    });

    const color = dynamicColors ? getDynamicColor(total, badgeColor) : badgeColor;
    await chrome.action.setBadgeText({ text: '' });
    await drawBadgeIcon(total, color, badgeShape);

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
