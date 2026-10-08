'use strict';
const { BrowserWindow, screen, shell, nativeTheme } = require('electron');
const path = require('path');
const { EVT } = require('../shared/ipc-channels');

/** Création et cycle de vie de la fenêtre principale. */
class WindowManager {
  constructor({ config, settings, logger, isDev }) {
    this.config = config; this.settings = settings; this.logger = logger; this.isDev = isDev;
    this.win = null;
    this.allowClose = false;
    this._boundsTimer = null;
  }

  _restoreBounds() {
    const def = { width: this.config.window.width, height: this.config.window.height };
    const saved = this.settings.get('windowBounds');
    if (!saved) return def;
    // La fenêtre doit rester au moins partiellement visible (écran débranché, résolution changée…)
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return saved.x + 80 < a.x + a.width && saved.x + saved.width - 80 > a.x && saved.y + 40 < a.y + a.height && saved.y > a.y - 40;
    });
    return visible ? saved : def;
  }

  create() {
    const bounds = this._restoreBounds();
    const iconPath = path.join(__dirname, '../../', this.config.windowIcon);
    const theme = this.settings.get('theme');
    nativeTheme.themeSource = theme;
    const dark = nativeTheme.shouldUseDarkColors;

    this.win = new BrowserWindow({
      ...bounds,
      minWidth: this.config.window.minWidth,
      minHeight: this.config.window.minHeight,
      show: false,
      frame: false,
      title: this.config.appName,
      icon: iconPath,
      backgroundColor: dark ? '#1e1f22' : '#f2f3f5',
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
        devTools: true,
      },
    });
    const win = this.win;

    if (this.settings.get('windowMaximized')) win.maximize();
    win.once('ready-to-show', () => win.show());
    win.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Sécurité : aucune navigation ni nouvelle fenêtre
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });

    const pushState = () => this.send(EVT.WINDOW_STATE, this.getState());
    win.on('maximize', pushState); win.on('unmaximize', pushState);
    win.on('enter-full-screen', pushState); win.on('leave-full-screen', pushState);
    win.on('resize', () => this._saveBoundsSoon());
    win.on('move', () => this._saveBoundsSoon());

    // Fermeture : le renderer vérifie d'abord les documents non sauvegardés
    win.on('close', (e) => {
      if (this.allowClose || win.webContents.isLoading() || win.webContents.isCrashed()) { this._saveBoundsNow(); return; }
      e.preventDefault();
      this.send(EVT.REQUEST_CLOSE);
    });
    win.webContents.on('render-process-gone', (_e, details) => {
      this.logger.error('Processus de rendu arrêté : ' + details.reason);
      this.allowClose = true;
    });
    win.on('closed', () => { this.win = null; });
    return win;
  }

  _saveBoundsSoon() {
    clearTimeout(this._boundsTimer);
    this._boundsTimer = setTimeout(() => this._saveBoundsNow(), 500);
  }
  _saveBoundsNow() {
    const w = this.win;
    if (!w || w.isDestroyed() || w.isFullScreen() || w.isMinimized()) return;
    try {
      const b = w.getNormalBounds();
      this.settings.set({ windowBounds: { x: b.x, y: b.y, width: b.width, height: b.height }, windowMaximized: w.isMaximized() });
    } catch (err) { this.logger.warn('Sauvegarde de la position impossible : ' + err.message); }
  }

  getState() {
    const w = this.win;
    return { maximized: !!w && w.isMaximized(), fullscreen: !!w && w.isFullScreen() };
  }

  send(channel, payload) {
    const w = this.win;
    if (w && !w.isDestroyed() && !w.webContents.isDestroyed()) w.webContents.send(channel, payload);
  }

  isTrusted(event) { return !!this.win && !this.win.isDestroyed() && event.sender === this.win.webContents; }

  focus() {
    const w = this.win;
    if (!w) return;
    if (w.isMinimized()) w.restore();
    w.show(); w.focus();
  }

  devToolsAllowed() { return this.isDev || this.settings.get('developerMode'); }
  toggleDevTools() {
    if (!this.devToolsAllowed()) return false;
    const wc = this.win.webContents;
    if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools({ mode: 'detach' });
    return true;
  }
}

module.exports = { WindowManager };
