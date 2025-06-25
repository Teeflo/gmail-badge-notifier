// Gmail Badge Notifier - background service worker
// Interroge périodiquement le flux Atom de Gmail et met à jour le badge

// Couleur du badge
const BADGE_COLOR = '#D93025';
// Intervalle en minutes pour la vérification
const CHECK_INTERVAL_MINUTES = 1;

/**
 * Met à jour le badge avec le nombre d'emails non lus.
 */
async function updateUnreadCount() {
  try {
    const response = await fetch('https://mail.google.com/mail/feed/atom', { credentials: 'include' });
    if (!response.ok) throw new Error('Network response was not ok');
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    const countElem = xml.querySelector('fullcount');
    if (!countElem) throw new Error('fullcount not found');
    const count = parseInt(countElem.textContent, 10);
    if (isNaN(count) || count === 0) {
      await chrome.action.setBadgeText({ text: '' });
    } else {
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      await chrome.action.setBadgeText({ text: count.toString() });
    }
  } catch (e) {
    // En cas d'erreur (par ex. non connecté), on efface le badge
    await chrome.action.setBadgeText({ text: '' });
  }
}

// Crée l'alarme lors de l'installation ou du démarrage de l'extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkMail', { periodInMinutes: CHECK_INTERVAL_MINUTES });
  updateUnreadCount(); // Vérification immédiate
});

// Réagit à l'alarme périodique
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkMail') {
    updateUnreadCount();
  }
});

// Ouvre Gmail et rafraîchit le compteur lorsqu'on clique sur l'icône
chrome.action.onClicked.addListener(() => {
  updateUnreadCount();
  chrome.tabs.create({ url: 'https://mail.google.com/' });
});
