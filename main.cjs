const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// Cho phép tự động phát âm thanh không bị chặn
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-speech-dispatcher');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required'
    },
    icon: path.join(__dirname, 'dist', 'favicon.ico'),
    title: 'Quản lý Dân cư & Chi bộ Đảng - TDP Quảng Giao',
  });

  // Tự động cấp quyền Micro để trợ lý ảo đàm thoại rảnh tay
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // Xóa Referer khi tải giọng nói Google TTS để tránh bị lỗi 404
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('translate.google.com/translate_tts')) {
      delete details.requestHeaders['Referer'];
      delete details.requestHeaders['referer'];
      delete details.requestHeaders['Origin'];
      delete details.requestHeaders['origin'];
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // Load built index.html
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Hide the default menu bar
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
