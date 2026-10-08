'use strict';
const { app, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const config = require('../../app.config');

// Nom et dossier de données fixes (identiques en dev et en production)
app.setName(config.appName);
app.setPath('userData', path.join(app.getPath('appData'), config.appName));

const { createLogger } = require('./logger');
const { SettingsManager } = require('../core/settings-manager');
const { RecentFilesManager, FavoritesManager } = require('../core/recent-files-manager');
const { FileManager } = require('./filesystem/file-manager');
const { FileWatcher } = require('./filesystem/file-watcher');
const { BackupManager } = require('./filesystem/backup-manager');
const { RecoveryManager } = require('./filesystem/recovery-manager');
const { DiscordRPC } = require('./discord/discord-rpc');
const { Updater } = require('./updater/updater');
const { WikiManager } = require('./wiki/wiki-manager');
const { Secrets } = require('./secrets');
const { WindowManager } = require('./window-manager');
const { setupMenu } = require('./menu-manager');
const { registerAllIpc } = require('./ipc');
const { EVT } = require('../shared/ipc-channels');
const { compareVersions } = require('../shared/changelog');

const isDev = !app.isPackaged || process.argv.includes('--dev');
const userData = app.getPath('userData');
const logger = createLogger({ dir: path.join(userData, 'logs'), isDev });

process.on('uncaughtException', (err) => logger.error('Exception non gérée (main)', err));
process.on('unhandledRejection', (err) => logger.error('Promesse rejetée non gérée (main)', err));

/** Fichiers passés en argument (« Ouvrir avec… », ligne de commande). */
function extractPaths(argv, cwd) {
  const args = argv.slice(app.isPackaged ? 1 : 2).filter((a) => !a.startsWith('-'));
  const out = [];
  for (const a of args) {
    try {
      const p = path.resolve(cwd || process.cwd(), a);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) out.push(p);
    } catch { /* ignore */ }
  }
  return out;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const ctx = { app, config, logger, isDev, initialPaths: extractPaths(process.argv) };

  app.on('second-instance', (_e, argv, cwd) => {
    if (ctx.windowManager) {
      ctx.windowManager.focus();
      if (ctx.pushOpenPaths) ctx.pushOpenPaths(extractPaths(argv, cwd));
    }
  });
  app.on('open-file', (e, p) => { // macOS
    e.preventDefault();
    if (ctx.pushOpenPaths && ctx.windowManager && ctx.windowManager.win) ctx.pushOpenPaths([p]); else ctx.initialPaths.push(p);
  });

  app.whenReady().then(() => {
    // ── 1. Initialisation ──
    logger.info(`Démarrage ${config.appName} ${app.getVersion()} (Electron ${process.versions.electron}, ${process.platform})`);
    if (process.platform === 'win32') app.setAppUserModelId(config.appId);

    // ── 2. Paramètres ──
    ctx.settings = new SettingsManager(path.join(userData, 'settings.json'), logger);
    ctx.settings.load();
    ctx.recent = new RecentFilesManager(ctx.settings);
    ctx.favorites = new FavoritesManager(ctx.settings);

    // ── 3. Système de fichiers + récupération ──
    ctx.fileManager = new FileManager({ maxFileSize: config.limits.maxFileSizeMB * 1024 * 1024, logger });
    ctx.backups = new BackupManager({
      dir: path.join(userData, 'backups'), logger,
      getKeep: () => ctx.settings.get('backupKeep'), getMaxAgeDays: () => ctx.settings.get('backupMaxAgeDays'),
    });
    ctx.backups.purgeOld().catch((e) => logger.warn('Nettoyage des backups : ' + e.message));
    ctx.recovery = new RecoveryManager({ dir: path.join(userData, 'recovery'), logger });

    // ── 4. Discord RPC ──
    ctx.discord = new DiscordRPC({ settings: ctx.settings, logger, userDataDir: userData });
    ctx.discord.init();

    // ── 5. Fenêtre ──
    ctx.windowManager = new WindowManager({ config, settings: ctx.settings, logger, isDev });
    ctx.watcher = new FileWatcher({ logger, onEvent: (evt) => ctx.windowManager.send(EVT.FILE_CHANGED, evt) });
    ctx.updater = new Updater({ app, config, logger, onStatus: (st) => ctx.windowManager.send(EVT.UPDATE_STATUS, st) });
    ctx.secrets = new Secrets({ dir: userData, safeStorage, logger });
    ctx.wiki = new WikiManager({
      bundledDir: path.join(__dirname, '../../assets/wiki'), dataDir: userData, config, logger,
      getSettings: () => ({ wikiStorage: ctx.settings.get('wikiStorage'), wikiGithubSync: ctx.settings.get('wikiGithubSync') }),
      getToken: () => ctx.secrets.getToken(),
    });

    // Sécurité : aucune permission web (caméra, géoloc…) n'est accordée
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

    setupMenu(config.appName);
    registerAllIpc(ctx);
    ctx.windowManager.create();

    // Au démarrage : vérification des mises à jour ET synchronisation du wiki, en parallèle (sans bloquer l'interface)
    ctx.windowManager.win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        const jobs = [];
        if (config.updates.checkOnStart) jobs.push(ctx.updater.check().then((r) => logger.info('Mises à jour : ' + r.message)));
        jobs.push(ctx.wiki.refresh().then((r) => { (r.ok ? logger.success : logger.warn).call(logger, 'Wiki : ' + r.message); ctx.windowManager.send(EVT.WIKI_UPDATED, r); }));
        Promise.allSettled(jobs);
      }, 1500);
    });
  }).catch((err) => { logger.error('Échec du démarrage', err); app.quit(); });

  app.on('window-all-closed', () => app.quit());

  let shuttingDown = false;
  app.on('before-quit', (e) => {
    if (shuttingDown) return;
    shuttingDown = true;
    e.preventDefault();
    logger.info('Arrêt de l’application…');
    Promise.resolve()
      .then(() => ctx.watcher && ctx.watcher.closeAll())
      .then(() => ctx.wiki && ctx.wiki.close())
      .then(() => ctx.settings && ctx.settings.flush())
      .then(() => ctx.discord && Promise.race([ctx.discord.shutdown(), new Promise((r) => setTimeout(r, 1500))]))
      .catch((err) => logger.error('Erreur à l’arrêt', err))
      .finally(() => app.exit(0));
  });
}
