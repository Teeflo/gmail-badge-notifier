// Gmail Badge Notifier - background service worker
// Interroge périodiquement le flux Atom de Gmail et met à jour le badge

// Couleur du badge
const BADGE_COLOR = '#D93025';
// Intervalle en minutes pour la vérification
const CHECK_INTERVAL_MINUTES = 1;

/**
 * Met à jour le badge avec le nombre d'emails non lus.
 */
/**
 * Récupère le flux Atom de Gmail via XHR pour éviter les problèmes CORS.
 */
function fetchAtomFeed() {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://mail.google.com/mail/feed/atom');
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`HTTP status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send();
  });
}

async function updateUnreadCount() {
  try {
    const text = await fetchAtomFeed();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    const countElem = xml.querySelector('fullcount');
    if (!countElem) throw new Error('fullcount not found');
    const count = parseInt(countElem.textContent, 10);
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    if (isNaN(count) || count === 0) {
      await chrome.action.setBadgeText({ text: '' });
    } else {
      await chrome.action.setBadgeText({ text: count.toString() });
    }
  } catch (e) {
    // En cas d'erreur (par ex. non connecté), on efface le badge
    await chrome.action.setBadgeText({ text: '' });
    console.error('Failed to update unread count:', e);
  }
}

// Crée l'alarme lors de l'installation ou du démarrage de l'extension
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('checkMail', { periodInMinutes: CHECK_INTERVAL_MINUTES });
  updateUnreadCount(); // Vérification immédiate
});

// Met à jour le badge et (re)programme l'alarme au démarrage du navigateur
chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create('checkMail', { periodInMinutes: CHECK_INTERVAL_MINUTES });
  updateUnreadCount();
});

// Réagit à l'alarme périodique
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkMail') {
    updateUnreadCount();
  }
});

// Ouvre Gmail ou active l'onglet existant lorsqu'on clique sur l'icône
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
