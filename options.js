async function saveOptions() {
  const color = document.getElementById('badgeColor').value;
  const dynamicColors = document.getElementById('dynamicColors').checked;
  const textColor = document.getElementById('textColor').value;
  const animation = document.getElementById('animation').value;
  const interval = parseFloat(document.getElementById('interval').value);
  const dndStart = document.getElementById('dndStart').value;
  const dndEnd = document.getElementById('dndEnd').value;
  const select = document.getElementById('soundSelect');
  let sound = select.value;
  const syncData = {
    badgeColor: color,
    textColor,
    dynamicColors,
    animation,
    interval,
    dndStart,
    dndEnd,
  };
  const localData = {};

  if (sound === 'custom') {
    const file = document.getElementById('customSound').files[0];
    if (file && file.size <= 500 * 1024) {
      const reader = new FileReader();
      reader.onload = async () => {
        syncData.sound = 'custom';
        localData.customSound = reader.result;
        await chrome.storage.sync.set(syncData);
        await chrome.storage.local.set(localData);
        showStatus();
        chrome.runtime.sendMessage({ action: 'optionsChanged' });
      };
      reader.readAsDataURL(file);
      return;
    }
    // If no file selected, keep previously stored custom sound
    sound = 'custom';
  }
  syncData.sound = sound;
  await chrome.storage.sync.set(syncData);
  if (Object.keys(localData).length) {
    await chrome.storage.local.set(localData);
  }
  showStatus();
  chrome.runtime.sendMessage({ action: 'optionsChanged' });
}

async function restoreOptions() {
  const {
    badgeColor,
    textColor,
    dynamicColors,
    animation,
    interval,
    dndStart,
    dndEnd,
    sound,
  } = await chrome.storage.sync.get({
    badgeColor: '#D93025',
    textColor: '#ffffff',
    dynamicColors: false,
    animation: 'none',
    interval: 1,
    dndStart: '',
    dndEnd: '',
    sound: 'none',
  });
  const { customSound } = await chrome.storage.local.get({ customSound: '' });
  document.getElementById('badgeColor').value = badgeColor;
  document.getElementById('textColor').value = textColor;
  document.getElementById('dynamicColors').checked = dynamicColors;
  document.getElementById('animation').value = animation;
  document.getElementById('interval').value = interval;
  document.getElementById('intervalVal').textContent = interval;
  document.getElementById('dndStart').value = dndStart;
  document.getElementById('dndEnd').value = dndEnd;
  const select = document.getElementById('soundSelect');
  if (sound === 'custom' && customSound) {
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
document.getElementById('textColor').addEventListener('change', saveOptions);
document.getElementById('soundSelect').addEventListener('change', () => {
  const value = document.getElementById('soundSelect').value;
  const fileInput = document.getElementById('customSound');
  fileInput.style.display = value === 'custom' ? 'block' : 'none';
  if (value !== 'custom') {
    saveOptions();
  }
});
document.getElementById('customSound').addEventListener('change', saveOptions);
document.getElementById('dynamicColors').addEventListener('change', saveOptions);
document.getElementById('animation').addEventListener('change', saveOptions);
document.getElementById('interval').addEventListener('input', () => {
  document.getElementById('intervalVal').textContent = document.getElementById('interval').value;
  saveOptions();
});
document.getElementById('dndStart').addEventListener('change', saveOptions);
document.getElementById('dndEnd').addEventListener('change', saveOptions);
