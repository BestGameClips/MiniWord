'use strict';
const { IPC } = require('../../shared/ipc-channels');
const { v } = require('./register');

function registerRecoveryIpc(ctx, handle) {
  const { recovery } = ctx;
  handle(IPC.RECOVERY_LIST, () => recovery.list());
  handle(IPC.RECOVERY_SAVE, (_e, entry) => {
    v.obj(entry, 'entry');
    return recovery.save({
      id: v.str(entry.id, 'id', 80), name: v.str(entry.name || '', 'name', 512), path: v.optStr(entry.path, 'path', 4096),
      content: v.str(entry.content, 'content', 200 * 1024 * 1024), encoding: v.str(entry.encoding || 'utf8', 'encoding', 20), eol: entry.eol,
    });
  });
  handle(IPC.RECOVERY_RESTORE, (_e, id) => recovery.get(v.str(id, 'id', 80)));
  handle(IPC.RECOVERY_CLEAR, async (_e, id) => {
    if (id === '*') await recovery.clearAll(); else await recovery.clear(v.str(id, 'id', 80));
    return true;
  });
}

module.exports = { registerRecoveryIpc };
