const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Chrome User Agent (Google OAuth "disallowed_useragent" engelini aşmak için zorunludur)
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_USER_AGENT;

// Persistent storage in user's AppData directory (Guaranteed permanent write access)
let appDataDir;
try {
  appDataDir = path.join(app.getPath('appData'), 'DevLog');
  fs.mkdirSync(appDataDir, { recursive: true });
  app.setPath('userData', appDataDir);
} catch (err) {
  appDataDir = path.join(__dirname, '../.app-data');
}

const sessionFilePath = path.join(appDataDir, 'auth_session.json');

// -------------------------------------------------------------
// Native IPC Handlers for 100% Bulletproof Session Storage
// -------------------------------------------------------------
ipcMain.handle('save-session', (event, data) => {
  try {
    fs.mkdirSync(appDataDir, { recursive: true });
    fs.writeFileSync(sessionFilePath, JSON.stringify(data), 'utf8');
    return { ok: true };
  } catch (e) {
    console.error('IPC save-session error:', e);
    return { error: e.message };
  }
});

ipcMain.handle('get-session', () => {
  try {
    if (fs.existsSync(sessionFilePath)) {
      const raw = fs.readFileSync(sessionFilePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('IPC get-session error:', e);
  }
  return null;
});

ipcMain.handle('clear-session', () => {
  try {
    if (fs.existsSync(sessionFilePath)) {
      fs.unlinkSync(sessionFilePath);
    }
  } catch (e) {}
  return { ok: true };
});

// -------------------------------------------------------------
// Auto-Updater Integration (electron-updater)
// -------------------------------------------------------------
let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
} catch (e) {
  console.warn('Auto-updater module not active:', e.message);
}

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) return { status: 'unsupported', message: 'Auto-updater hazır değil.' };
  try {
    const res = await autoUpdater.checkForUpdates();
    return { status: 'checking', updateInfo: res?.updateInfo };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('install-update', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
  }
});

function setupUpdaterEvents() {
  if (!autoUpdater) return;
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking', message: 'Güncellemeler kontrol ediliyor...' });
  });
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'available', version: info.version, message: `Yeni sürüm (${info.version}) indiriliyor...` });
  });
  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available', message: 'Uygulamanız en güncel sürümde.' });
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', { status: 'downloaded', version: info.version, message: 'Güncelleme indirildi! Yeniden başlatabilirsiniz.' });
  });
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-status', { status: 'error', message: err.message });
  });
}

// -------------------------------------------------------------
// Embedded Local HTTP Server (Guarantees permanent web origin & IndexedDB)
// -------------------------------------------------------------
const distDir = path.join(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

let assignedPort = 23854;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://127.0.0.1:${assignedPort}`);

  // Disk Session API Endpoints (Failsafe for Remember Me)
  if (parsedUrl.pathname === '/api/session') {
    if (req.method === 'GET') {
      try {
        if (fs.existsSync(sessionFilePath)) {
          const raw = fs.readFileSync(sessionFilePath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(raw);
          return;
        }
      } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          fs.writeFileSync(sessionFilePath, body, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      try {
        if (fs.existsSync(sessionFilePath)) {
          fs.unlinkSync(sessionFilePath);
        }
      } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
  }

  // Static File Serving
  try {
    let reqPath = decodeURIComponent(parsedUrl.pathname);
    let fullPath = path.join(distDir, reqPath.replace(/^\//, ''));

    if (reqPath === '/' || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      fullPath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(fullPath);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Server Error: ' + err.message);
  }
});

server.on('error', (err) => {
  console.warn('Server error:', err);
});

let mainWindow;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'DevLog',
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  setupUpdaterEvents();

  // Load from local HTTP server (using localhost for Firebase Authorized Domain compatibility)
  mainWindow.loadURL(`http://localhost:${port}/index.html`);

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  // Google OAuth Popup Pencerelerine İzin Ver
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('firebaseapp.com') || url.includes('google.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          }
        }
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Yeni açılan pencerelerde de User Agent'ı Chrome olarak tut
app.on('web-contents-created', (event, contents) => {
  contents.setUserAgent(CHROME_USER_AGENT);
});

app.whenReady().then(() => {
  server.listen(0, '127.0.0.1', () => {
    assignedPort = server.address().port;
    console.log(`DevLog embedded server running on http://127.0.0.1:${assignedPort}`);
    createWindow(assignedPort);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(assignedPort);
    }
  });
});

app.on('will-quit', () => {
  try {
    server.close();
  } catch (e) {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
