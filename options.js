function saveOptions() {
  const color = document.getElementById('badgeColor').value;
  const select = document.getElementById('soundSelect');
  const sound = select.value;
  if (sound === 'custom') {
    const file = document.getElementById('customSound').files[0];
    if (file && file.size <= 500 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        chrome.storage.sync.set({ badgeColor: color, sound: reader.result });
      };
      reader.readAsDataURL(file);
    }
  } else {
    chrome.storage.sync.set({ badgeColor: color, sound: sound });
  }
}

function restoreOptions() {
  chrome.storage.sync.get({ badgeColor: '#D93025', sound: 'none' }, (items) => {
    document.getElementById('badgeColor').value = items.badgeColor;
    const select = document.getElementById('soundSelect');
    if (items.sound.startsWith('data:')) {
      select.value = 'custom';
    } else {
      select.value = items.sound;
    }
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('badgeColor').addEventListener('change', saveOptions);
document.getElementById('soundSelect').addEventListener('change', () => {
  const fileInput = document.getElementById('customSound');
  fileInput.style.display = document.getElementById('soundSelect').value === 'custom' ? 'block' : 'none';
  saveOptions();
});
document.getElementById('customSound').addEventListener('change', saveOptions);
