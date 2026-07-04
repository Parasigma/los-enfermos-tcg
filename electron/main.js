'use strict';
/* =========================================================
   PROCESO PRINCIPAL DE ELECTRON
   - Abre la ventana del juego.
   - A petición del renderer (jugar online como host), arranca
     el servidor relé WebSocket local y devuelve las IPs.
   ========================================================= */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { startRelay } = require('./relay');

const MP_PORT = 8688;
let win = null;
let relay = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1680,
    height: 1000,
    minWidth: 1100,
    minHeight: 660,
    backgroundColor: '#0b1a17',
    autoHideMenuBar: true,
    title: 'Los Enfermos: El TCG del Manicomio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

/* IPs locales para que el rival sepa dónde unirse */
function localIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out.length ? out : ['127.0.0.1'];
}

ipcMain.handle('mp-ips', () => ({ port: MP_PORT, ips: localIPs() }));

ipcMain.handle('mp-host', () => {
  if (!relay) relay = startRelay(MP_PORT);
  return { port: MP_PORT, ips: localIPs() };
});

ipcMain.handle('mp-stop', () => {
  if (relay) {
    relay.close();
    relay = null;
  }
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
