'use strict';
const { ipcMain } = require('electron');
const path = require('path');

class IpcError extends Error {
  constructor(code, message) { super(message); this.name = 'IpcError'; this.code = code; }
}

/** Validateurs d'arguments IPC : toute donnée du renderer est considérée comme non fiable. */
const v = {
  str(x, name, max = 1024) { if (typeof x !== 'string' || x.length > max) throw new IpcError('E_ARG', `Argument invalide : ${name}`); return x; },
  optStr(x, name, max = 1024) { return x == null ? null : v.str(x, name, max); },
  bool(x, name) { if (typeof x !== 'boolean') throw new IpcError('E_ARG', `Argument invalide : ${name}`); return x; },
  num(x, name) { if (typeof x !== 'number' || !Number.isFinite(x)) throw new IpcError('E_ARG', `Argument invalide : ${name}`); return x; },
  optNum(x, name) { return x == null ? null : v.num(x, name); },
  obj(x, name) { if (x === null || typeof x !== 'object' || Array.isArray(x)) throw new IpcError('E_ARG', `Argument invalide : ${name}`); return x; },
  oneOf(x, list, name) { if (!list.includes(x)) throw new IpcError('E_ARG', `Argument invalide : ${name}`); return x; },
  absPath(x, name = 'chemin') {
    if (typeof x !== 'string' || !x || x.length > 4096 || x.includes('\0') || !path.isAbsolute(x)) throw new IpcError('E_PATH', 'Chemin de fichier invalide.');
    return x;
  },
  pathList(x, max = 50) {
    if (!Array.isArray(x) || x.length > max) throw new IpcError('E_ARG', 'Liste de chemins invalide.');
    return x.map((p) => v.absPath(p));
  },
};

function userMessage(err) {
  if (err && err.userMessage) return err.userMessage;
  if (err && typeof err.code === 'string' && err.code.startsWith('E_')) return err.message;
  return 'Une erreur inattendue est survenue.';
}

/** Fabrique `handle(channel, fn)` : vérifie l'expéditeur, capture les erreurs, ne renvoie jamais de stack. */
function createHandle(ctx) {
  return function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        if (!ctx.windowManager.isTrusted(event)) throw new IpcError('E_UNTRUSTED', 'Expéditeur non autorisé.');
        const data = await fn(event, ...args);
        return { ok: true, data: data === undefined ? null : data };
      } catch (err) {
        const expected = err && typeof err.code === 'string' && err.code.startsWith('E_');
        (expected ? ctx.logger.warn : ctx.logger.error).call(ctx.logger, `IPC ${channel} : ${err && err.message}`, expected ? undefined : err);
        return { ok: false, error: { code: (err && err.code) || 'E_UNKNOWN', message: userMessage(err) } };
      }
    });
  };
}

module.exports = { createHandle, IpcError, v };
