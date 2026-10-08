'use strict';
const { IPC } = require('../../shared/ipc-channels');
const { v } = require('./register');

function registerWindowIpc(ctx, handle) {
  const wm = ctx.windowManager;
  handle(IPC.WINDOW_MINIMIZE, () => { wm.win.minimize(); });
  handle(IPC.WINDOW_MAXIMIZE, () => { if (wm.win.isMaximized()) wm.win.unmaximize(); else wm.win.maximize(); return wm.getState(); });
  handle(IPC.WINDOW_CLOSE, () => { wm.win.close(); });
  handle(IPC.WINDOW_CONFIRM_CLOSE, () => { wm.allowClose = true; wm.win.close(); });
  handle(IPC.WINDOW_FULLSCREEN, () => { wm.win.setFullScreen(!wm.win.isFullScreen()); return wm.getState(); });
  handle(IPC.WINDOW_DEVTOOLS, () => {
    if (!wm.toggleDevTools()) { const e = new Error('Les outils de développement sont désactivés (Paramètres › Avancé › Mode développeur).'); e.code = 'E_DEVTOOLS'; throw e; }
  });
  handle(IPC.WINDOW_GET_STATE, () => wm.getState());
  handle(IPC.WINDOW_SET_TITLE, (_e, title) => { wm.win.setTitle(v.str(title, 'title', 300)); });
}

module.exports = { registerWindowIpc };
