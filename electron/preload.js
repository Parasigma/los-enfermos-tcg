'use strict';
/* Puente seguro entre la página del juego y Electron */

const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronMP', {
  host: () => ipcRenderer.invoke('mp-host'),
  stop: () => ipcRenderer.invoke('mp-stop'),
  ips: () => ipcRenderer.invoke('mp-ips'),
  copy: text => { clipboard.writeText(String(text)); return true; }
});
