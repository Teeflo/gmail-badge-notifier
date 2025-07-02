/**
 * Popup script displaying unread counts per account.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('accounts');
  const { lastCounts } = await chrome.storage.local.get({ lastCounts: {} });
  const entries = Object.entries(lastCounts);
  if (entries.length === 0) {
    container.textContent = 'No accounts detected.';
    return;
  }
  for (const [email, count] of entries) {
    const div = document.createElement('div');
    div.className = 'account';
    const spanEmail = document.createElement('span');
    spanEmail.textContent = email;
    const spanCount = document.createElement('span');
    spanCount.className = 'count';
    spanCount.textContent = count;
    div.append(spanEmail, spanCount);
    container.appendChild(div);
  }
});
