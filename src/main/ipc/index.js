'use strict';
const { createHandle } = require('./register');
const { registerFileIpc } = require('./file-ipc');
const { registerWindowIpc } = require('./window-ipc');
const { registerSettingsIpc } = require('./settings-ipc');
const { registerSystemIpc } = require('./system-ipc');
const { registerRecoveryIpc } = require('./recovery-ipc');
const { registerDiscordIpc } = require('./discord-ipc');
const { registerWikiIpc } = require('./wiki-ipc');

/** Point d'entrée unique : tous les handlers IPC sont enregistrés ici. */
function registerAllIpc(ctx) {
  const handle = createHandle(ctx);
  registerFileIpc(ctx, handle);
  registerWindowIpc(ctx, handle);
  registerSettingsIpc(ctx, handle);
  registerSystemIpc(ctx, handle);
  registerRecoveryIpc(ctx, handle);
  registerDiscordIpc(ctx, handle);
  registerWikiIpc(ctx, handle);
}

module.exports = { registerAllIpc };
