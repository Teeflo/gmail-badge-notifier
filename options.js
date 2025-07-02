async function saveOptions() {
  const color = document.getElementById('badgeColor').value;
  const dynamicColors = document.getElementById('dynamicColors').checked;
  const shape = document.getElementById('badgeShape').value;
  const animation = document.getElementById('animation').value;
  const interval = parseFloat(document.getElementById('interval').value);
  const dndStart = document.getElementById('dndStart').value;
  const dndEnd = document.getElementById('dndEnd').value;
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
  await chrome.storage.sync.set({
    badgeColor: color,
    dynamicColors,
    badgeShape: shape,
    animation,
    interval,
    dndStart,
    dndEnd,
    sound,
  });
  showStatus();
}

async function restoreOptions() {
  const {
    badgeColor,
    dynamicColors,
    badgeShape,
    animation,
    interval,
    dndStart,
    dndEnd,
    sound,
  } = await chrome.storage.sync.get({
    badgeColor: '#D93025',
    dynamicColors: false,
    badgeShape: 'round',
    animation: 'none',
    interval: 1,
    dndStart: '',
    dndEnd: '',
    sound: 'none',
  });
  document.getElementById('badgeColor').value = badgeColor;
  document.getElementById('dynamicColors').checked = dynamicColors;
  document.getElementById('badgeShape').value = badgeShape;
  document.getElementById('animation').value = animation;
  document.getElementById('interval').value = interval;
  document.getElementById('intervalVal').textContent = interval;
  document.getElementById('dndStart').value = dndStart;
  document.getElementById('dndEnd').value = dndEnd;
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
document.getElementById('dynamicColors').addEventListener('change', saveOptions);
document.getElementById('badgeShape').addEventListener('change', saveOptions);
document.getElementById('animation').addEventListener('change', saveOptions);
document.getElementById('interval').addEventListener('input', () => {
  document.getElementById('intervalVal').textContent = document.getElementById('interval').value;
  saveOptions();
});
document.getElementById('dndStart').addEventListener('change', saveOptions);
document.getElementById('dndEnd').addEventListener('change', saveOptions);
