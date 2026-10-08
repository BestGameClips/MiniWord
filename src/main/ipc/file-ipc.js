'use strict';
const { dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { IPC, EVT } = require('../../shared/ipc-channels');
const { openDialogFilters, saveDialogFilters, DEFAULT_EXTENSION } = require('../../shared/constants');
const { extname, basename, dirname } = require('../../shared/utils');
const { languageForExtension } = require('../../shared/constants');
const { v, IpcError } = require('./register');

const ENCODINGS = ['utf8', 'utf8-bom', 'utf16le', 'utf16be', 'windows-1252'];

function registerFileIpc(ctx, handle) {
  const { fileManager, watcher, backups, recent, settings, windowManager } = ctx;
  let lastDir = null;

  const startDir = () => {
    if (lastDir && fs.existsSync(lastDir)) return lastDir;
    return ctx.app.getPath('documents');
  };

  async function readOne(p, { track = true, watch = true } = {}) {
    try {
      const file = await fileManager.readFile(p);
      lastDir = file.directory;
      if (watch) watcher.watch(p, file);
      if (track) recent.add(p);
      return { ok: true, file };
    } catch (err) {
      ctx.logger.warn(`Lecture impossible (${p}) : ${err.message}`);
      return { ok: false, path: p, error: { code: err.code || 'E_IO', message: err.code && err.code.startsWith('E_') ? err.message : 'Impossible de lire ce fichier.' } };
    }
  }

  handle(IPC.FILE_OPEN, async () => {
    const res = await dialog.showOpenDialog(windowManager.win, {
      title: 'Ouvrir un fichier', defaultPath: startDir(), properties: ['openFile', 'multiSelections'], filters: openDialogFilters(),
    });
    if (res.canceled || !res.filePaths.length) return [];
    const out = [];
    for (const p of res.filePaths) out.push(await readOne(p));
    return out;
  });

  handle(IPC.FILE_OPEN_PATHS, async (_e, paths, opts) => {
    const list = v.pathList(paths);
    const track = !(opts && opts.track === false);
    const out = [];
    for (const p of list) out.push(await readOne(p, { track }));
    return out;
  });

  handle(IPC.FILE_READ, async (_e, p, opts) => {
    v.absPath(p);
    const watch = !(opts && opts.watch === false);
    const r = await readOne(p, { track: false, watch });
    if (!r.ok) throw new IpcError(r.error.code, r.error.message);
    return r.file;
  });

  function parseSaveArgs(a) {
    v.obj(a, 'options');
    return {
      content: v.str(a.content, 'content', 200 * 1024 * 1024),
      encoding: v.oneOf(a.encoding || 'utf8', ENCODINGS, 'encoding'),
      eol: v.oneOf(a.eol || 'LF', ['LF', 'CRLF'], 'eol'),
    };
  }

  handle(IPC.FILE_SAVE, async (_e, a) => {
    const p = v.absPath(a && a.path);
    const { content, encoding, eol } = parseSaveArgs(a);
    const manual = a.reason === 'manual';
    const res = await fileManager.writeFile(p, content, {
      encoding, eol, expectedMtimeMs: v.optNum(a.expectedMtimeMs, 'expectedMtimeMs'), expectedSize: v.optNum(a.expectedSize, 'expectedSize'),
      beforeWrite: settings.get('backupEnabled') ? (target) => backups.backup(target, { force: manual }) : null,
    });
    if (!res.conflict) { watcher.updateKnown(p, res); ctx.logger.debug('Sauvegardé : ' + p + ' (' + res.size + ' o, ' + (a.reason || 'manual') + ')'); } else ctx.logger.warn('Conflit de sauvegarde : ' + p);
    return res;
  });

  // Écriture forcée (après résolution d'un conflit : « Conserver ma version »)
  handle(IPC.FILE_WRITE, async (_e, a) => {
    const p = v.absPath(a && a.path);
    const { content, encoding, eol } = parseSaveArgs(a);
    const res = await fileManager.writeFile(p, content, {
      encoding, eol, force: true, beforeWrite: (target) => backups.backup(target, { force: true }),
    });
    watcher.watch(p, res);
    return res;
  });

  handle(IPC.FILE_SAVE_AS, async (_e, a) => {
    v.obj(a, 'options');
    const { content, encoding, eol } = parseSaveArgs(a);
    const suggested = v.optStr(a.suggestedName, 'suggestedName', 255) || 'Nouveau document.' + DEFAULT_EXTENSION;
    const dir = a.defaultDir && path.isAbsolute(a.defaultDir) && fs.existsSync(a.defaultDir) ? a.defaultDir : startDir();
    const res = await dialog.showSaveDialog(windowManager.win, {
      title: 'Enregistrer sous', defaultPath: path.join(dir, suggested), filters: saveDialogFilters(extname(suggested)),
    });
    if (res.canceled || !res.filePath) return null;
    let target = res.filePath;
    if (!path.extname(target)) target += '.' + DEFAULT_EXTENSION;
    const w = await fileManager.writeFile(target, content, {
      encoding, eol, force: true, beforeWrite: settings.get('backupEnabled') ? (t) => backups.backup(t, { force: true }) : null,
    });
    lastDir = dirname(target);
    watcher.watch(target, w);
    recent.add(target);
    const ext = extname(target);
    return { path: target, name: basename(target), directory: dirname(target), extension: ext, language: languageForExtension(ext), mtimeMs: w.mtimeMs, size: w.size, ino: w.ino, encoding, eol };
  });

  handle(IPC.FILE_DELETE, async (_e, p) => {
    v.absPath(p);
    try { await shell.trashItem(p); } catch (err) { throw new IpcError('E_TRASH', 'Impossible de déplacer le fichier dans la corbeille.'); }
    return true;
  });

  handle(IPC.FILE_REVEAL, async (_e, p) => {
    v.absPath(p);
    if (fs.existsSync(p)) shell.showItemInFolder(p);
    else { const d = path.dirname(p); if (fs.existsSync(d)) await shell.openPath(d); else throw new IpcError('E_NOT_FOUND', 'Le dossier est introuvable.'); }
    return true;
  });

  handle(IPC.FILE_WATCH, async (_e, a) => {
    v.obj(a, 'options');
    watcher.watch(v.absPath(a.path), { mtimeMs: v.optNum(a.mtimeMs, 'mtimeMs'), size: v.optNum(a.size, 'size'), ino: a.ino || 0 });
    return true;
  });
  handle(IPC.FILE_UNWATCH, async (_e, p) => { watcher.unwatch(v.absPath(p)); return true; });

  void EVT;
}

module.exports = { registerFileIpc };
