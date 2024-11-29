const ipc = require('electron').ipcRenderer;
const pathin = document.getElementById('setpathin');
const pathout = document.getElementById('setpathout');

document.getElementById('loginUploadbtn').addEventListener('click', function() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (username && password) {
    ipc.send('update-config', username, password);
  } else {
    alert("Username dan password harus diisi.");
  }
});

document.addEventListener('DOMContentLoaded', () => {
  ipc.send('check-config'); 
});


ipc.on('null', function (event, missingPaths) {
  console.log(missingPaths);
  const notificationDiv = document.getElementById('pathMissingNotification');
  const messageElement = document.getElementById('missingPathsMessage');
  
  messageElement.textContent = `Path ${missingPaths} belum diisi`;

  notificationDiv.style.display = 'block';

  setTimeout(() => {
    notificationDiv.style.display = 'none';
  }, 5000);
});



