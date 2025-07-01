const DEFAULTS = {
  badgeColor: '#D93025',
  sound: 'none',
  soundEnabled: true,
  volume: 1,
  darkMode: false,
  shortcut: 'Ctrl+Shift+F'
};
let currentShortcut = DEFAULTS.shortcut;

function showStatus(text) {
  const status = document.getElementById('status');
  status.textContent = text || chrome.i18n.getMessage('statusSaved');
  status.style.opacity = '1';
  setTimeout(() => {
    status.style.opacity = '0';
  }, 1000);
}

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
}

async function saveOptions() {
  const color = document.getElementById('badgeColor').value;
  const soundSelect = document.getElementById('soundSelect');
  let sound = soundSelect.value;
  const soundEnabled = document.getElementById('soundEnabled').checked;
  const volume = parseFloat(document.getElementById('volume').value);
  const darkMode = document.getElementById('darkModeSwitch').checked;
  if (sound === 'custom') {
    const file = document.getElementById('customSound').files[0];
    if (file && file.size <= 500 * 1024) {
      const reader = new FileReader();
      reader.onload = async () => {
        await chrome.storage.sync.set({ badgeColor: color, sound: reader.result, soundEnabled, volume, darkMode, shortcut: currentShortcut });
        document.getElementById('colorPreview').style.backgroundColor = color;
        applyTheme(darkMode);
        showStatus();
      };
      reader.readAsDataURL(file);
      return;
    }
  }
  await chrome.storage.sync.set({ badgeColor: color, sound, soundEnabled, volume, darkMode, shortcut: currentShortcut });
  document.getElementById('colorPreview').style.backgroundColor = color;
  applyTheme(darkMode);
  showStatus();
}

async function restoreOptions() {
  const opts = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('badgeColor').value = opts.badgeColor;
  document.getElementById('colorPreview').style.backgroundColor = opts.badgeColor;
  const select = document.getElementById('soundSelect');
  if (opts.sound.startsWith('data:')) {
    select.value = 'custom';
  } else {
    select.value = opts.sound;
  }
  document.getElementById('soundEnabled').checked = opts.soundEnabled;
  document.getElementById('volume').value = opts.volume;
  document.getElementById('darkModeSwitch').checked = opts.darkMode;
  applyTheme(opts.darkMode);
  currentShortcut = opts.shortcut;
  document.getElementById('shortcutInput').value = opts.shortcut;
  populatePresets();
  updateStats();
}

function populatePresets() {
  const presets = {
    silent: { badgeColor: '#777', sound: 'none', soundEnabled: false, volume: 0 },
    classic: { badgeColor: '#D93025', sound: 'sounds/ding.mp3', soundEnabled: true, volume: 1 },
    alarm: { badgeColor: '#D93025', sound: 'sounds/notify.mp3', soundEnabled: true, volume: 1 }
  };
  const select = document.getElementById('presetSelect');
  select.innerHTML = '<option value="">--</option>' +
    Object.keys(presets).map(k => `<option value="${k}">${k}</option>`).join('');
  select.onchange = () => {
    const preset = presets[select.value];
    if (!preset) return;
    document.getElementById('badgeColor').value = preset.badgeColor;
    document.getElementById('soundSelect').value = preset.sound;
    document.getElementById('soundEnabled').checked = preset.soundEnabled;
    document.getElementById('volume').value = preset.volume;
    saveOptions();
  };
}

function switchTab(e) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.hidden = true);
  const tab = e.target.getAttribute('data-tab');
  document.getElementById(tab).hidden = false;
  e.target.classList.add('active');
}

function recordShortcut() {
  const input = document.getElementById('shortcutInput');
  input.value = '';
  const handler = (e) => {
    e.preventDefault();
    let combo = '';
    if (e.ctrlKey) combo += 'Ctrl+';
    if (e.shiftKey) combo += 'Shift+';
    if (e.altKey) combo += 'Alt+';
    if (e.metaKey) combo += 'Meta+';
    combo += e.key;
    currentShortcut = combo;
    input.value = combo;
    document.removeEventListener('keydown', handler);
    saveOptions();
  };
  document.addEventListener('keydown', handler);
}

async function exportOptions() {
  const data = await chrome.storage.sync.get();
  const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gmail-badge-options.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importOptions(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      await chrome.storage.sync.set(data);
      restoreOptions();
      showStatus('Imported');
    } catch (e) {
      console.error('Import failed', e);
    }
  };
  reader.readAsText(file);
}

async function updateStats() {
  const { stats } = await chrome.storage.local.get({ stats: { notifications: 0, lastCheck: null } });
  const area = document.getElementById('statsArea');
  const last = stats.lastCheck ? new Date(stats.lastCheck).toLocaleString() : '-';
  area.textContent = `Notifications: ${stats.notifications}\nLast check: ${last}`;
}

document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', switchTab));
  document.getElementById('badgeColor').addEventListener('input', saveOptions);
  document.getElementById('soundSelect').addEventListener('change', saveOptions);
  document.getElementById('customSound').addEventListener('change', saveOptions);
  document.getElementById('soundEnabled').addEventListener('change', saveOptions);
  document.getElementById('volume').addEventListener('input', saveOptions);
  document.getElementById('darkModeSwitch').addEventListener('change', saveOptions);
  document.getElementById('exportBtn').addEventListener('click', exportOptions);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importOptions);
  document.getElementById('recordShortcut').addEventListener('click', recordShortcut);
});
