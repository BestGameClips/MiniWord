(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Canaux IPC centralisés (renderer → main : invoke).
   * ⚠ Le preload (sandboxé) ne peut pas importer ce fichier : ses chaînes sont
   *   dupliquées dans src/preload/preload.js. Le test `tests/ipc.test.js`
   *   vérifie qu'elles restent synchronisées.
   */
  const IPC = Object.freeze({
    APP_GET_INFO: 'app:get-info',
    APP_GET_INITIAL_PATHS: 'app:get-initial-paths',
    APP_CHECK_UPDATES: 'app:check-updates',
    APP_LOG: 'app:log',

    FILE_OPEN: 'file:open',
    FILE_OPEN_PATHS: 'file:open-paths',
    FILE_READ: 'file:read',
    FILE_SAVE: 'file:save',
    FILE_SAVE_AS: 'file:save-as',
    FILE_WRITE: 'file:write',
    FILE_DELETE: 'file:delete',
    FILE_REVEAL: 'file:reveal',
    FILE_WATCH: 'file:watch',
    FILE_UNWATCH: 'file:unwatch',

    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_CLOSE: 'window:close',
    WINDOW_CONFIRM_CLOSE: 'window:confirm-close',
    WINDOW_FULLSCREEN: 'window:fullscreen',
    WINDOW_DEVTOOLS: 'window:devtools',
    WINDOW_GET_STATE: 'window:get-state',
    WINDOW_SET_TITLE: 'window:set-title',

    SETTINGS_GET: 'settings:get',
    SETTINGS_SET: 'settings:set',
    SETTINGS_RESET: 'settings:reset',
    RECENT_REMOVE: 'recent:remove',
    RECENT_CLEAR: 'recent:clear',
    FAVORITE_ADD: 'favorite:add',
    FAVORITE_REMOVE: 'favorite:remove',

    DISCORD_UPDATE: 'discord:update',
    DISCORD_CLEAR: 'discord:clear',
    DISCORD_STATUS: 'discord:status',
    DISCORD_RECONNECT: 'discord:reconnect',
    DISCORD_PREVIEW: 'discord:preview',

    RECOVERY_LIST: 'recovery:list',
    RECOVERY_SAVE: 'recovery:save',
    RECOVERY_RESTORE: 'recovery:restore',
    RECOVERY_CLEAR: 'recovery:clear',

    UPDATE_DOWNLOAD: 'update:download',
    UPDATE_INSTALL: 'update:install',
    CHANGELOG_GET: 'changelog:get',
    LOG_HISTORY: 'log:history',
    DEV_DIAGNOSTICS: 'dev:diagnostics',

    WIKI_LIST: 'wiki:list',
    WIKI_GET: 'wiki:get',
    WIKI_REFRESH: 'wiki:refresh',
    WIKI_INFO: 'wiki:info',
    WIKI_SAVE: 'wiki:save',
    WIKI_DELETE: 'wiki:delete',
    WIKI_PUSH: 'wiki:push',
    ADMIN_STATE: 'admin:state',
    ADMIN_UNLOCK: 'admin:unlock',
    GITHUB_TOKEN_SET: 'github:token-set',
    SYSTEM_OPEN_EXTERNAL: 'system:open-external',

    SYSTEM_EDIT: 'system:edit',
    SYSTEM_OPEN_FOLDER: 'system:open-folder',
  });

  /** Évènements main → renderer */
  const EVT = Object.freeze({
    REQUEST_CLOSE: 'evt:request-close',
    WINDOW_STATE: 'evt:window-state',
    FILE_CHANGED: 'evt:file-changed',
    OPEN_PATHS: 'evt:open-paths',
    DISCORD_STATUS: 'evt:discord-status',
    LOG_ENTRY: 'evt:log-entry',
    UPDATE_STATUS: 'evt:update-status',
    WIKI_UPDATED: 'evt:wiki-updated',
  });

  return { IPC, EVT };
});
