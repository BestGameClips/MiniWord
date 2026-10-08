'use strict';
const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { IPC, EVT } = require('../../shared/ipc-channels');
const { v } = require('./register');

function registerSystemIpc(ctx, handle) {
  const { app, config, logger, windowManager, updater } = ctx;
  let initialPaths = ctx.initialPaths || [];

  handle(IPC.APP_GET_INFO, () => ({
    name: config.appName, version: app.getVersion(), description: config.description, copyright: config.copyright,
    electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome,
    platform: process.platform, isDev: ctx.isDev, packaged: app.isPackaged,
    userData: app.getPath('userData'), updatesEnabled: updater.configured, githubRepo: config.github && config.github.owner && config.github.repo ? config.github.owner + '/' + config.github.repo : null,
  }));
  handle(IPC.APP_GET_INITIAL_PATHS, () => { const p = initialPaths; initialPaths = []; return p; });
  handle(IPC.APP_CHECK_UPDATES, () => updater.check());
  handle(IPC.APP_LOG, (_e, a) => {
    v.obj(a, 'log');
    const level = v.oneOf(a.level, ['debug', 'info', 'success', 'warn', 'error'], 'level');
    const err = a.stack ? { stack: v.str(a.stack, 'stack', 8000) } : null;
    logger.log(level, v.str(a.message, 'message', 4000), err, 'renderer');
  });

  handle(IPC.UPDATE_DOWNLOAD, () => updater.download());
  handle(IPC.UPDATE_INSTALL, () => { windowManager.allowClose = true; try { updater.install(); } catch (e) { windowManager.allowClose = false; throw e; } });
  handle(IPC.CHANGELOG_GET, () => { try { return fs.readFileSync(path.join(__dirname, '../../../CHANGELOG.md'), 'utf8'); } catch { return ''; } });

  // Console développeur : historique + flux temps réel (uniquement si le mode développeur est actif)
  const devOn = () => ctx.isDev || ctx.settings.get('developerMode');
  handle(IPC.LOG_HISTORY, () => { if (!devOn()) throw Object.assign(new Error('Mode développeur requis.'), { code: 'E_DEV' }); return logger.history(); });
  logger.subscribe((entry) => { if (devOn()) windowManager.send(EVT.LOG_ENTRY, entry); });
  handle(IPC.DEV_DIAGNOSTICS, () => {
    if (!devOn()) throw Object.assign(new Error('Mode développeur requis.'), { code: 'E_DEV' });
    const mem = process.memoryUsage();
    return {
      app: { name: config.appName, version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, arch: process.arch },
      versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
      memoryMB: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
      paths: { userData: app.getPath('userData'), logs: logger.dir },
      discord: ctx.discord.getStatus(), updater: updater.state, wiki: ctx.wiki.info(),
      watchedDirs: ctx.watcher ? ctx.watcher.dirs.size : 0, uptimeSec: Math.round(process.uptime()),
    };
  });

  handle(IPC.SYSTEM_EDIT, (event, action) => {
    v.oneOf(action, ['cut', 'copy', 'paste', 'pasteAndMatchStyle', 'selectAll'], 'action');
    event.sender[action]();
  });

  handle(IPC.SYSTEM_OPEN_FOLDER, async (_e, which) => {
    v.oneOf(which, ['logs', 'backups', 'userData'], 'dossier');
    const dir = which === 'logs' ? ctx.logger.dir : which === 'backups' ? ctx.backups.dir : app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    const err = await shell.openPath(path.resolve(dir));
    if (err) throw Object.assign(new Error('Impossible d’ouvrir le dossier.'), { code: 'E_OPEN' });
  });

  /** Paramètre mutable : utilisé par main.js pour les fichiers reçus via la ligne de commande. */
  ctx.pushOpenPaths = (paths) => { if (paths.length) windowManager.send(EVT.OPEN_PATHS, paths); };
}

module.exports = { registerSystemIpc };
