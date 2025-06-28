async function saveOptions() {
  const color = document.getElementById('badgeColor').value;
  const select = document.getElementById('soundSelect');
  const sound = select.value;
  if (sound === 'custom') {
    const file = document.getElementById('customSound').files[0];
    if (file && file.size <= 500 * 1024) {
      const reader = new FileReader();
      reader.onload = async () => {
        await chrome.storage.sync.set({ badgeColor: color, sound: reader.result });
        showStatus();
      };
      reader.readAsDataURL(file);
      return;
    }
  }
  await chrome.storage.sync.set({ badgeColor: color, sound });
  showStatus();
}

async function restoreOptions() {
  const { badgeColor, sound } = await chrome.storage.sync.get({
    badgeColor: '#D93025',
    sound: 'none',
  });
  document.getElementById('badgeColor').value = badgeColor;
  const select = document.getElementById('soundSelect');
  if (sound.startsWith('data:')) {
    select.value = 'custom';
  } else {
    select.value = sound;
  }
}

function showStatus() {
  const status = document.getElementById('status');
  status.textContent = 'Options saved';
  status.style.opacity = '1';
  setTimeout(() => {
    status.style.opacity = '0';
  }, 1000);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('badgeColor').addEventListener('change', saveOptions);
document.getElementById('soundSelect').addEventListener('change', () => {
  const fileInput = document.getElementById('customSound');
  fileInput.style.display = document.getElementById('soundSelect').value === 'custom' ? 'block' : 'none';
  saveOptions();
});
document.getElementById('customSound').addEventListener('change', saveOptions);
