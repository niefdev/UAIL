const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
const uploaderPath = path.join(__dirname, './repo/uploader.js');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('UI/index.html');
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    console.log('[ ! ] Semua jendela ditutup, keluar dari aplikasi.');
  }
});

ipcMain.on('open-folder-dialog-for-folder-in', function (event) {
  console.log('[ ! ] Membuka dialog folder untuk Path In');
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths.length > 0) {
      event.sender.send('selected-folder-in', result.filePaths[0]);
    } else {
      console.log('[ ! ] Tidak ada folder yang dipilih untuk Path In.');
    }
  }).catch(err => {
    console.log('[ ! ] Terjadi kesalahan saat membuka dialog folder:', err);
  });
});

ipcMain.on('open-folder-dialog-for-folder-out', function (event) {
  console.log('[ ! ] Membuka dialog folder untuk Path Out');
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths.length > 0) {
      event.sender.send('selected-folder-out', result.filePaths[0]);
    } else {
      console.log('[ ! ] Tidak ada folder yang dipilih untuk Path Out.');
    }
  }).catch(err => {
    console.log('[ ! ] Terjadi kesalahan saat membuka dialog folder:', err);
  });
});

ipcMain.on('update-config', (event, username, password) => {
  const configFilePath = path.join(__dirname, 'config.json');

  fs.readFile(configFilePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('[ ! ] Terjadi kesalahan saat membaca file config:', err);
      return;
    }

    let config = JSON.parse(data);

    config.username = username;
    config.password = password;

    fs.readFile(uploaderPath, 'utf8', (err, data) => {
      if (err) {
        console.error('[ ! ] Gagal membaca file uploader.js:', err);
        return;
      }
    
      try {
        eval(data);
        console.log('[ ! ] Skrip uploader berhasil dijalankan.');
      } catch (err) {
        console.error('[ ! ] Terjadi kesalahan saat menjalankan skrip uploader:', err);
      }
    });
    
  });
});

app.whenReady().then(() => {
  createWindow();
  console.log('[ ! ] Aplikasi siap dan jendela telah dibuat.');

  ipcMain.on('login-success', (event, username) => {
    console.log(`[ ! ] Login berhasil dengan user: ${username}`);
    mainWindow.loadURL(`UI/success.html?username=${encodeURIComponent(username)}`);  });

  ipcMain.on('login-failed', (event, username) => {
    console.log(`[ ! ] Login gagal untuk user: ${username}`);
    mainWindow.webContents.send('show-login-failed', username);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      console.log('[ ! ] Tidak ada jendela yang ditemukan, membuat jendela baru.');
    }
  });
});
