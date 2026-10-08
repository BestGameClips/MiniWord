'use strict';
/**
 * Preload sécurisé : SEULE passerelle entre le renderer et le système.
 * Le renderer n'a accès ni à fs, ni à child_process, ni à process, ni à electron.
 *
 * ⚠ Les noms de canaux sont dupliqués depuis src/shared/ipc-channels.js (un preload
 *   sandboxé ne peut pas importer de fichiers locaux). tests/ipc.test.js vérifie la cohérence.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (res && res.ok) return res.data;
  const err = new Error((res && res.error && res.error.message) || 'Erreur inconnue.');
  err.code = res && res.error && res.error.code;
  throw err;
}

function subscribe(channel, cb) {
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,

  app: {
    getInfo: () => call('app:get-info'),
    getInitialPaths: () => call('app:get-initial-paths'),
    checkUpdates: () => call('app:check-updates'),
    downloadUpdate: () => call('update:download'),
    installUpdate: () => call('update:install'),
    onUpdateStatus: (cb) => subscribe('evt:update-status', cb),
    getChangelog: () => call('changelog:get'),
    openExternal: (url) => call('system:open-external', url),
    log: (level, message, stack) => call('app:log', { level, message: String(message).slice(0, 4000), stack: stack ? String(stack).slice(0, 8000) : undefined }).catch(() => {}),
    onOpenPaths: (cb) => subscribe('evt:open-paths', cb),
    onRequestClose: (cb) => subscribe('evt:request-close', cb),
  },

  files: {
    open: () => call('file:open'),
    openPaths: (paths, opts) => call('file:open-paths', paths, opts),
    read: (path, opts) => call('file:read', path, opts),
    save: (args) => call('file:save', args),
    saveAs: (args) => call('file:save-as', args),
    write: (args) => call('file:write', args),
    delete: (path) => call('file:delete', path),
    reveal: (path) => call('file:reveal', path),
    watch: (args) => call('file:watch', args),
    unwatch: (path) => call('file:unwatch', path),
    onChanged: (cb) => subscribe('evt:file-changed', cb),
    /** Chemin réel d'un fichier déposé (File.path n'existe plus dans les versions récentes d'Electron). */
    getPathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  },

  window: {
    minimize: () => call('window:minimize'),
    maximize: () => call('window:maximize'),
    close: () => call('window:close'),
    confirmClose: () => call('window:confirm-close'),
    toggleFullscreen: () => call('window:fullscreen'),
    devTools: () => call('window:devtools'),
    getState: () => call('window:get-state'),
    setTitle: (title) => call('window:set-title', title).catch(() => {}),
    onState: (cb) => subscribe('evt:window-state', cb),
  },

  settings: {
    get: () => call('settings:get'),
    set: (patch) => call('settings:set', patch),
    reset: () => call('settings:reset'),
  },
  recent: {
    remove: (path) => call('recent:remove', path),
    clear: () => call('recent:clear'),
  },
  favorites: {
    add: (path) => call('favorite:add', path),
    remove: (path) => call('favorite:remove', path),
  },

  discord: {
    update: (payload) => call('discord:update', payload),
    clear: () => call('discord:clear'),
    status: () => call('discord:status'),
    reconnect: () => call('discord:reconnect'),
    preview: () => call('discord:preview'),
    onStatus: (cb) => subscribe('evt:discord-status', cb),
  },

  dev: {
    history: () => call('log:history'),
    diagnostics: () => call('dev:diagnostics'),
    onLog: (cb) => subscribe('evt:log-entry', cb),
  },

  wiki: {
    list: () => call('wiki:list'),
    get: (slug) => call('wiki:get', slug),
    refresh: () => call('wiki:refresh'),
    info: () => call('wiki:info'),
    save: (page) => call('wiki:save', page),
    delete: (slug) => call('wiki:delete', slug),
    push: (slug) => call('wiki:push', slug),
    adminState: () => call('admin:state'),
    unlock: (password) => call('admin:unlock', password),
    setGithubToken: (token) => call('github:token-set', token),
    onUpdated: (cb) => subscribe('evt:wiki-updated', cb),
  },

  recovery: {
    list: () => call('recovery:list'),
    save: (entry) => call('recovery:save', entry),
    restore: (id) => call('recovery:restore', id),
    clear: (id) => call('recovery:clear', id),
  },

  system: {
    edit: (action) => call('system:edit', action),
    openFolder: (which) => call('system:open-folder', which),
  },
});
