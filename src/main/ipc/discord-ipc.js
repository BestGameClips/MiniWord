'use strict';
const { IPC, EVT } = require('../../shared/ipc-channels');
const { v } = require('./register');

const STATUSES = ['idle', 'reading', 'editing', 'saving', 'searching'];

function registerDiscordIpc(ctx, handle) {
  const { discord, windowManager } = ctx;
  discord.on('status', (s) => windowManager.send(EVT.DISCORD_STATUS, s));

  handle(IPC.DISCORD_UPDATE, (_e, p) => {
    v.obj(p, 'payload');
    // Seules ces métadonnées sont acceptées — jamais le contenu du document
    discord.setPresence({
      status: v.oneOf(p.status, STATUSES, 'status'),
      fileName: v.optStr(p.fileName, 'fileName', 512),
      filePath: v.optStr(p.filePath, 'filePath', 4096),
      isUntitled: !!p.isUntitled,
      docId: v.optStr(p.docId, 'docId', 100),
      tabCount: Math.max(0, Math.min(999, Number(p.tabCount) || 0)),
    });
  });
  handle(IPC.DISCORD_CLEAR, () => discord.clear());
  handle(IPC.DISCORD_STATUS, () => discord.getStatus());
  handle(IPC.DISCORD_RECONNECT, async () => { await discord.reconnect(); return discord.getStatus(); });
  handle(IPC.DISCORD_PREVIEW, () => discord.getPreview());
}

module.exports = { registerDiscordIpc };
