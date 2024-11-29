const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const glob = require('glob');
const { setData, getData } = require("./cache");

let mainWindow;

const uploaderPath = path.join(__dirname, '/repo/uploader.js');
const CONFIG_PATH = path.join(__dirname, "config.json");
let filesArray = []

const readConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
    return {};
  } catch (error) {
    console.error('[ ! ] Error membaca config:', error);
    return {};
  }
};

let config = readConfig();
function sendLog(message) {
  if (mainWindow) {
    mainWindow.webContents.send('receive-log', message);
  }
}

module.exports = { sendLog };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: __dirname + '/preload.js', 
    },
  });

  try {
    if (config.path && config.path.rename) {
      const rename = config.path.rename;

      const resolvedPath = path.resolve(rename);

      if (fs.existsSync(resolvedPath)) {
        if (fs.lstatSync(resolvedPath).isFile()) {
          if (path.extname(resolvedPath).toLowerCase() === ".pdf") {
            filesArray.push(resolvedPath);
          } else {
            console.warn(`[!] Error: Bukan merupakan file PDF - ${resolvedPath}`);
          }
        } else {
          const matchedFiles = glob.sync(path.join(resolvedPath, '**/*.pdf'), { absolute: true });

          matchedFiles.forEach((pdfFile) => filesArray.push(pdfFile));

          if (matchedFiles.length === 0) {
            console.warn(`[!] Error: Tidak ada file PDF yang ditemukan dalam direktori - ${resolvedPath}`);
          }
        }
      } else {
        console.warn(`[!] Error: Path upload tidak ditemukan - ${resolvedPath}`);
      }
    } else {
      console.warn('[!] Error: Path upload tidak ada dalam konfigurasi');
    }
  } catch (error) {
    console.warn("[!] Error:", error.message);
  }


  mainWindow.loadFile('UI/index.html');
  console.log('[ ! ] Jendela utama dimuat.');
}

function validatePaths(config) {
  const requiredPaths = ['path.upload', 'path.rename', 'path.raw', 'path.done'];
  const missingPaths = [];

  requiredPaths.forEach(key => {
    const keys = key.split('.');
    let value = config;
    keys.forEach(k => value = value && value[k]);
    if (!value) missingPaths.push(" " + key.replace("path.", "").toLowerCase().replace(/^./, c => c.toUpperCase()));
  });

  return missingPaths;
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    console.log('[ ! ] Semua jendela ditutup, keluar dari aplikasi.');
  }
});

ipcMain.on('open-folder-dialog-for-folder-done', function (event) {
  console.log('[ ! ] Membuka dialog folder untuk Path done');
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths.length > 0) {
      event.sender.send('selected-folder-done', result.filePaths[0]);
    } else {
      console.log('[ ! ] Tidak ada folder yang dipilih untuk Path done.');
    }
  }).catch(err => {
    console.log('[ ! ] Terjadi kesalahan saat membuka dialog folder:', err);
  });
});

ipcMain.on('open-folder-dialog-for-folder-rename', function (event) {
  console.log('[ ! ] Membuka dialog folder untuk Path rename');
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths.length > 0) {
      event.sender.send('selected-folder-rename', result.filePaths[0]);
    } else {
      console.log('[ ! ] Tidak ada folder yang dipilih untuk Path rename.');
    }
  }).catch(err => {
    console.log('[ ! ] Terjadi kesalahan saat membuka dialog folder:', err);
  });
});

ipcMain.on('open-folder-dialog-for-folder-error', function (event) {
  console.log('[ ! ] Membuka dialog folder untuk Path error');
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths.length > 0) {
      event.sender.send('selected-folder-error', result.filePaths[0]);
    } else {
      console.log('[ ! ] Tidak ada folder yang dipilih untuk Path error.');
    }
  }).catch(err => {
    console.log('[ ! ] Terjadi kesalahan saat membuka dialog folder:', err);
  });
});

ipcMain.on('open-folder-dialog-for-folder-upload', function (event) {
  console.log('[ ! ] Membuka dialog folder untuk Path upload');
  dialog.showOpenDialog({
    properties: ['openDirectory']
  }).then(result => {
    if (result.filePaths.length > 0) {
      event.sender.send('selected-folder-upload', result.filePaths[0]);
    } else {
      console.log('[ ! ] Tidak ada folder yang dipilih untuk Path upload.');
    }
  }).catch(err => {
    console.log('[ ! ] Terjadi kesalahan saat membuka dialog folder:', err);
  });
});

ipcMain.on('check-config', function (event) {
  if (!fs.existsSync(CONFIG_PATH)) {
    event.sender.send('null', ['Config file tidak ditemukan.']);
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const missingPaths = validatePaths(config);

  if (missingPaths.length > 0) {
    event.sender.send('null', missingPaths);
  }

});

ipcMain.on('update-config', (event, username, password) => {
  const configFilePath = path.join(__dirname, 'config.json');
  const filePath = path.join(__dirname, "repo", "uploader.js");

  fs.readFile(configFilePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('[ ! ] Terjadi kesalahan saat membaca file config:', err);
      return;
    }

    let config = JSON.parse(data);
    
    config.username = username;
    config.password = password;

    // spawn('gnome-terminal', ['--', 'bash', '-c', 'python3 API/main.py; exec bash']);
    

    fs.readFile(uploaderPath, 'utf8', (err, repoCode) => {
      console.log(repoCode)
      if (err) {
        console.error('[ ! ] Gagal membaca file uploader.js:', err);
        return;
      }

      try {
        eval(repoCode);
        console.log('[ ! ] Skrip uploader berhasil dijalankan.');
      } catch (err) {
        console.error('[ ! ] Terjadi kesalahan saat menjalankan skrip uploader:', err);
      }
    });

  })
})

app.whenReady().then(() => {
  createWindow();
  console.log('[ ! ] Aplikasi siap dan jendela telah dibuat.');

  const checkInterval = setInterval(() => {
    if (getData() === "1") {
      console.log(getData())
      console.log(`[ ! ] Login berhasil dengan user: ${config.username}`);
      mainWindow.loadURL(`file:///home/zyx/Desktop/project/UAIL/UI/success.html?username=${encodeURIComponent(config.username)}`);
      
      // Setelah login berhasil, hentikan pemeriksaan lebih lanjut
      clearInterval(checkInterval);
    } else {
      // console.log("[ ! ] Belum login atau kondisi belum terpenuhi.");
    }
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      console.log('[ ! ] Tidak ada jendela yang ditemukan, membuat jendela baru.');
    }
  });
});
