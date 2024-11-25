const ipc = require('electron').ipcRenderer;
const pathin = document.getElementById('setpathin');
const pathout = document.getElementById('setpathout');

// document.getElementById('uploadBtn').addEventListener('click', function() {
//   const username = document.getElementById('username').value;
//   const password = document.getElementById('password').value;

//   if (username && password) {
//     ipc.send('update-config', username, password);
//   } else {
//     alert("Username dan password harus diisi.");
//   }
// });

pathin.addEventListener('click', function (event) {
  ipc.send('open-folder-dialog-for-folder-in');
});

pathout.addEventListener('click', function (event) {
  ipc.send('open-folder-dialog-for-folder-out');
});

ipc.on('selected-folder-in', function (event, folderPath) {
  console.log('Folder selected for Path In:', folderPath);
  document.getElementById('pathIn').value = folderPath;
});

ipc.on('selected-folder-out', function (event, folderPath) {
  console.log('Folder selected for Path Out:', folderPath);
  document.getElementById('pathOut').value = folderPath;
});
