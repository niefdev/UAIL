const ipc = require('electron').ipcRenderer;
const fs = require('fs');
const path = require('path');

const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');

const configPath = path.join(__dirname, '../config.json');

function saveConfig(newData) {
  let existingData = {};
  if (fs.existsSync(configPath)) {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    existingData = JSON.parse(fileContent);
  }

  if (!existingData.settings) {
    existingData.settings = {
      mode: "simple",
      path: {
        done: "",
        rename: "",
        error: "",
        delete: "",
      },
    };
  }

  existingData.settings = {
    ...existingData.settings,
    ...newData.settings,
  };

  fs.writeFileSync(configPath, JSON.stringify(existingData, null, 2), 'utf-8');
  console.log('Konfigurasi berhasil diperbarui:', existingData);
}

document.getElementById('saveBtn').addEventListener('click', function () {
  const newSettings = {
    settings: {
      mode: document.getElementById('simplePath').checked ? "simple" : "advanced",
      path: {
        done: paths.done,
        rename: paths.rename,
        error: paths.error,
        upload: paths.upload,
      },
    },
  }
  saveConfig(newSettings);
});


// Element
closeModal.addEventListener('click', () => {
  modal.classList.add('hidden');
});
document.getElementById('simplePath').addEventListener('change', function () {
  document.getElementById('simpleButton').classList.remove('hidden');
  document.getElementById('advancedButtons').classList.add('hidden');
});

document.getElementById('advancePath').addEventListener('change', function () {
  document.getElementById('simpleButton').classList.add('hidden');
  document.getElementById('advancedButtons').classList.remove('hidden');
});

document.getElementById('saveBtn').addEventListener('click', function () {
  const alertBox = document.getElementById('alertBox');
  alertBox.classList.remove('opacity-0', 'translate-y-20');
  alertBox.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');

  setTimeout(function () {
    alertBox.classList.remove('opacity-100', 'translate-y-0');
    alertBox.classList.add('opacity-0', 'translate-y-20');
  }, 3000);


});

// Buttons
const buttons = {
  upload: document.getElementById('uploadBtn'),
  rename: document.getElementById('renameBtn'),
  error: document.getElementById('errorBtn'),
  done: document.getElementById('doneBtn'),
  save: document.getElementById('saveBtn'),
  simple: document.getElementById('simpleMainBtn'),

};

// Previews
const previews = {
  upload: document.getElementById('uploadPath'),
  rename: document.getElementById('renamePath'),
  error: document.getElementById('errorPath'),
  done: document.getElementById('donePath'),
  simple: document.getElementById('mainPreview'),
};

// Modal Elements
const showPathElement = document.getElementById('path');
const showModal = document.getElementById('modal');

// Path Variables
const paths = {
  upload: '',
  rename: '',
  error: '',
  done: '',
};

// Utility to show the modal with a specific path
function showModalWithPath(path) {
  showPathElement.textContent = path;
  showModal.classList.remove('hidden');
}

// IPC Events to store paths
ipc.on('selected-folder-upload', (event, path) => (paths.upload = path));
ipc.on('selected-folder-rename', (event, path) => (paths.rename = path));
ipc.on('selected-folder-error', (event, path) => (paths.error = path));
ipc.on('selected-folder-done', (event, path) => (paths.done = path));
ipc.on('selected-folder-main', (event, path) => (paths.done = path));


// Add Event Listeners for IPC communication
buttons.upload.addEventListener('click', () => ipc.send('open-folder-dialog-for-folder-upload'));
buttons.rename.addEventListener('click', () => ipc.send('open-folder-dialog-for-folder-rename'));
buttons.error.addEventListener('click', () => ipc.send('open-folder-dialog-for-folder-error'));
buttons.done.addEventListener('click', () => ipc.send('open-folder-dialog-for-folder-done'));

// Add Event Listeners for Previews to show modal
previews.upload.addEventListener('click', () => paths.upload && showModalWithPath(paths.upload));
previews.rename.addEventListener('click', () => paths.rename && showModalWithPath(paths.rename));
previews.error.addEventListener('click', () => paths.error && showModalWithPath(paths.error));
previews.done.addEventListener('click', () => paths.done && showModalWithPath(paths.done));
previews.simple.addEventListener('click', () => paths.simple && showModalWithPath(paths.simple));

