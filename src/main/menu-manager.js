'use strict';
const { Menu, app } = require('electron');

/**
 * Windows/Linux : pas de menu natif (barre de titre personnalisée, raccourcis gérés par le renderer).
 * macOS : menu minimal indispensable pour que copier/coller/annuler fonctionnent.
 */
function setupMenu(appName) {
  if (process.platform !== 'darwin') { Menu.setApplicationMenu(null); return; }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: appName, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Édition', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Fenêtre', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] },
  ]));
  void app;
}

module.exports = { setupMenu };
