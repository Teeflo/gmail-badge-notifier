async function saveOptions() {
  const color = document.getElementById('badgeColor').value;
  const dynamicColors = document.getElementById('dynamicColors').checked;
  const textColor = document.getElementById('textColor').value;
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
        await chrome.storage.sync.set({
          badgeColor: color,
          textColor,
          dynamicColors,
          animation,
          interval,
          dndStart,
          dndEnd,
          sound: reader.result,
        });
        showStatus();
        chrome.runtime.sendMessage({ action: 'optionsChanged' });
      };
      reader.readAsDataURL(file);
      return;
    }
  }
  await chrome.storage.sync.set({
    badgeColor: color,
    textColor,
    dynamicColors,
    animation,
    interval,
    dndStart,
    dndEnd,
    sound,
  });
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
  document.getElementById('badgeColor').value = badgeColor;
  document.getElementById('textColor').value = textColor;
  document.getElementById('dynamicColors').checked = dynamicColors;
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


document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();
  document.getElementById('interval').addEventListener('input', () => {
    document.getElementById('intervalVal').textContent = document.getElementById('interval').value;
  });
  document.getElementById('soundSelect').addEventListener('change', () => {
    const customRow = document.getElementById('customSoundRow');
    if (document.getElementById('soundSelect').value === 'custom') {
      customRow.style.display = 'block';
    } else {
      customRow.style.display = 'none';
    }
  });
  // Affiche le champ customSound si custom est déjà sélectionné
  if (document.getElementById('soundSelect').value === 'custom') {
    document.getElementById('customSoundRow').style.display = 'block';
  } else {
    document.getElementById('customSoundRow').style.display = 'none';
  }
  document.getElementById('optionsForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveOptions();
  });
});
