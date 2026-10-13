const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

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
// Auto-Updater Integration (electron-updater for Windows, Custom Native for macOS)
// -------------------------------------------------------------
let autoUpdater = null;
if (process.platform !== 'darwin') {
  try {
    const updaterModule = require('electron-updater');
    autoUpdater = updaterModule.autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'Aliiidimi',
      repo: 'DevLog'
    });
  } catch (e) {
    console.warn('Auto-updater module not active:', e.message);
  }
}

let isMacUpdating = false;
let macExtractedAppPath = null;

function compareVersions(v1, v2) {
  const parse = v => (v || '').replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
  const a = parse(v1);
  const b = parse(v2);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const num1 = a[i] || 0;
    const num2 = b[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function fetchLatestGithubRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/Aliiidimi/DevLog/releases/latest',
      headers: {
        'User-Agent': 'DevLog-Desktop-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return https.get(res.headers.location, { headers: { 'User-Agent': 'DevLog-Desktop-App' } }, (locRes) => {
          let data = '';
          locRes.on('data', chunk => data += chunk);
          locRes.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`GitHub API HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFileWithProgress(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    function requestUrl(currentUrl, hops = 0) {
      if (hops > 10) return reject(new Error('Çok fazla yönlendirme'));
      const parsed = new URL(currentUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      client.get(currentUrl, { headers: { 'User-Agent': 'DevLog-Desktop-App' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let nextUrl = res.headers.location;
          if (!nextUrl.startsWith('http')) {
            nextUrl = new URL(nextUrl, currentUrl).href;
          }
          return requestUrl(nextUrl, hops + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`İndirme başarısız: HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let receivedBytes = 0;
        const file = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0 && onProgress) {
            const percent = Math.min(98, Math.round((receivedBytes / totalBytes) * 100));
            onProgress(percent);
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => resolve());
        });

        file.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', reject);
    }

    requestUrl(url);
  });
}

async function checkMacUpdates() {
  if (isMacUpdating) return;
  mainWindow?.webContents.send('update-status', { status: 'checking', message: 'Güncellemeler kontrol ediliyor...' });

  try {
    const releaseData = await fetchLatestGithubRelease();
    const latestTag = releaseData.tag_name || '';
    const latestVersion = latestTag.replace(/^v/, '');
    const currentVersion = app.getVersion();

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      mainWindow?.webContents.send('update-status', { status: 'not-available', message: 'Uygulamanız en güncel sürümde.' });
      return;
    }

    const zipAsset = releaseData.assets?.find(a => 
      process.arch === 'arm64' 
        ? a.name.includes('-arm64-mac.zip') || a.name.includes('-mac.zip')
        : a.name.includes('-mac.zip') && !a.name.includes('-arm64')
    ) || releaseData.assets?.find(a => a.name.endsWith('-mac.zip') || a.name.endsWith('.zip'));

    if (!zipAsset) {
      mainWindow?.webContents.send('update-status', { 
        status: 'error', 
        message: `Yeni sürüm (${latestVersion}) bulundu ancak Mac zip paketi henüz hazır değil.` 
      });
      return;
    }

    mainWindow?.webContents.send('update-status', { 
      status: 'available', 
      version: latestVersion, 
      message: `Yeni sürüm (${latestVersion}) indiriliyor...` 
    });

    isMacUpdating = true;
    const tmpZip = path.join(app.getPath('temp'), `DevLog-${latestVersion}.zip`);
    const extractDir = path.join(app.getPath('temp'), `DevLog-update-${Date.now()}`);

    await downloadFileWithProgress(zipAsset.browser_download_url, tmpZip, (percent) => {
      mainWindow?.webContents.send('update-status', { status: 'downloading', percent });
    });

    mainWindow?.webContents.send('update-status', { 
      status: 'downloading', 
      percent: 99, 
      message: 'Güncelleme paketi açılıyor...' 
    });

    fs.mkdirSync(extractDir, { recursive: true });
    const { execSync } = require('child_process');
    execSync(`/usr/bin/unzip -q -o "${tmpZip}" -d "${extractDir}"`);

    const items = fs.readdirSync(extractDir);
    const appDir = items.find(f => f.endsWith('.app'));
    if (!appDir) {
      throw new Error('İndirilen zip paketi içinde DevLog.app bulunamadı.');
    }

    macExtractedAppPath = path.join(extractDir, appDir);

    try {
      execSync(`/usr/bin/xattr -cr "${macExtractedAppPath}"`);
    } catch (e) {}

    isMacUpdating = false;

    mainWindow?.webContents.send('update-status', { 
      status: 'downloaded', 
      version: latestVersion, 
      message: 'Güncelleme indirildi! Yeniden başlatabilirsiniz.' 
    });
  } catch (err) {
    isMacUpdating = false;
    mainWindow?.webContents.send('update-status', { status: 'error', message: err.message });
  }
}

function installMacUpdate() {
  if (!macExtractedAppPath || !fs.existsSync(macExtractedAppPath)) {
    console.warn('Yüklenecek Mac güncelleme dosyası bulunamadı. GitHub sayfası açılıyor.');
    shell.openExternal('https://github.com/Aliiidimi/DevLog/releases/latest');
    return;
  }

  const execPath = process.execPath;
  const match = execPath.match(/(.*?\.app)\//);
  let currentAppPath = match ? match[1] : '/Applications/DevLog.app';

  // Eğer kullanıcı DMG içinden açmışsa hedef Applications klasörüdür
  if (currentAppPath.startsWith('/Volumes/')) {
    currentAppPath = '/Applications/DevLog.app';
  }

  const scriptPath = path.join(app.getPath('temp'), 'devlog_mac_updater.sh');
  const scriptContent = `#!/bin/bash
sleep 1
TARGET_PATH="${currentAppPath}"
rm -rf "$TARGET_PATH" 2>/dev/null || true
cp -R "${macExtractedAppPath}" "$TARGET_PATH"
xattr -cr "$TARGET_PATH" 2>/dev/null || true
open -n "$TARGET_PATH"
`;

  try {
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    const { spawn } = require('child_process');
    const child = spawn('/bin/bash', [scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    app.quit();
  } catch (err) {
    console.error('Mac güncelleme betiği çalıştırılamadı:', err);
    shell.openExternal('https://github.com/Aliiidimi/DevLog/releases/latest');
  }
}

ipcMain.handle('open-external', (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('check-for-updates', async () => {
  if (process.platform === 'darwin') {
    checkMacUpdates().catch(err => {
      mainWindow?.webContents.send('update-status', { status: 'error', message: err.message });
    });
    return { status: 'checking' };
  }

  if (!autoUpdater) return { status: 'unsupported', message: 'Auto-updater hazır değil.' };
  try {
    const res = await autoUpdater.checkForUpdates();
    return { status: 'checking', updateInfo: res?.updateInfo };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('install-update', () => {
  if (process.platform === 'darwin') {
    installMacUpdate();
  } else if (autoUpdater) {
    autoUpdater.quitAndInstall();
  }
});

function setupUpdaterEvents() {
  if (process.platform === 'darwin') return;
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

    // Uygulama açılışından 3 saniye sonra sessizce arka planda güncellemeleri kontrol et
    setTimeout(() => {
      if (process.platform === 'darwin') {
        checkMacUpdates().catch(err => {
          console.warn('Açılışta Mac güncelleme kontrolü:', err.message);
        });
      } else if (autoUpdater) {
        autoUpdater.checkForUpdates().catch(err => {
          console.warn('Açılışta otomatik güncelleme kontrolü:', err.message);
        });
      }
    }, 3000);
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
