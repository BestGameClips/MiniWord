'use strict';
const { nativeTheme } = require('electron');
const { IPC } = require('../../shared/ipc-channels');
const { v } = require('./register');

function registerSettingsIpc(ctx, handle) {
  const { settings, recent, favorites, discord, backups } = ctx;

  // Effets de bord des changements de paramètres (quelle que soit leur origine)
  settings.onChange((patch) => {
    if ('theme' in patch) nativeTheme.themeSource = settings.get('theme');
    if ('discordRPC' in patch) discord.applySettings();
    if ('recentLimit' in patch) recent.trim();
    if ('backupMaxAgeDays' in patch) backups.purgeOld().catch(() => {});
  });

  handle(IPC.SETTINGS_GET, () => settings.getAll());
  handle(IPC.SETTINGS_SET, (_e, patch) => settings.set(patch));
  handle(IPC.SETTINGS_RESET, () => settings.reset({ keepData: true }));

  handle(IPC.RECENT_REMOVE, (_e, p) => { recent.remove(v.str(p, 'path', 4096)); return settings.getAll(); });
  handle(IPC.RECENT_CLEAR, () => { recent.clear(); return settings.getAll(); });
  handle(IPC.FAVORITE_ADD, (_e, p) => { favorites.add(v.absPath(p)); return settings.getAll(); });
  handle(IPC.FAVORITE_REMOVE, (_e, p) => { favorites.remove(v.str(p, 'path', 4096)); return settings.getAll(); });
}

module.exports = { registerSettingsIpc };
