const ipc = require('electron').ipcRenderer;

const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');

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

};

// Previews
const previews = {
  upload: document.getElementById('uploadPath'),
  rename: document.getElementById('renamePath'),
  error: document.getElementById('errorPath'),
  done: document.getElementById('donePath'),
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
