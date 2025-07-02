/**
 * Displays unread counts stored by the background script.
 */
async function showCounts() {
  const container = document.getElementById('accounts');
  container.innerHTML = '';
  const { lastCounts = {} } = await chrome.storage.local.get({ lastCounts: {} });
  const emails = Object.keys(lastCounts);
  if (emails.length === 0) {
    container.textContent = 'No accounts detected';
    return;
  }
  for (const email of emails) {
    const row = document.createElement('div');
    row.className = 'account';
    row.innerHTML = `<span>${email}</span><span>${lastCounts[email]}</span>`;
    container.appendChild(row);
  }
}

document.getElementById('openGmail').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://mail.google.com/' });
});

document.addEventListener('DOMContentLoaded', showCounts);
