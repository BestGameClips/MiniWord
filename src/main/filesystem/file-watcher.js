'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const CASE_INSENSITIVE = process.platform === 'win32' || process.platform === 'darwin';
const key = (p) => (CASE_INSENSITIVE ? p.toLowerCase() : p);

/**
 * Surveille les fichiers ouverts (un watcher par dossier, partagé).
 * Évènements émis via onEvent({ path, type: 'changed'|'deleted'|'moved', newPath?, mtimeMs? }).
 * Les écritures faites par l'application sont ignorées grâce à `updateKnown`.
 */
class FileWatcher {
  constructor({ onEvent, logger, debounceMs = 250 } = {}) {
    this.onEvent = onEvent || (() => {});
    this.logger = logger;
    this.debounceMs = debounceMs;
    this.dirs = new Map(); // dirKey → { dir, watcher, files: Map<fileKey, entry> }
  }

  watch(filePath, known = {}) {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    let d = this.dirs.get(key(dir));
    if (!d) {
      d = { dir, watcher: null, files: new Map() };
      this.dirs.set(key(dir), d);
      try {
        d.watcher = fs.watch(dir, { persistent: false }, (evt, filename) => this._onDirEvent(d, filename));
        d.watcher.on('error', (err) => { this.logger && this.logger.warn('Watcher erreur : ' + err.message); this._checkAll(d); });
      } catch (err) {
        this.logger && this.logger.warn('Impossible de surveiller ' + dir + ' : ' + err.message);
      }
    }
    const k = key(resolved);
    const prev = d.files.get(k);
    if (prev) clearTimeout(prev.timer);
    d.files.set(k, { path: resolved, known: { mtimeMs: known.mtimeMs ?? null, size: known.size ?? null, ino: known.ino ?? 0 }, state: 'present', timer: null });
  }

  /** Met à jour l'état connu (après une écriture de l'application). */
  updateKnown(filePath, st) {
    const resolved = path.resolve(filePath);
    const d = this.dirs.get(key(path.dirname(resolved)));
    const e = d && d.files.get(key(resolved));
    if (e) { e.known = { mtimeMs: st.mtimeMs, size: st.size, ino: st.ino }; e.state = 'present'; }
  }

  unwatch(filePath) {
    const resolved = path.resolve(filePath);
    const dk = key(path.dirname(resolved));
    const d = this.dirs.get(dk);
    if (!d) return;
    const e = d.files.get(key(resolved));
    if (e) clearTimeout(e.timer);
    d.files.delete(key(resolved));
    if (d.files.size === 0) { try { d.watcher && d.watcher.close(); } catch { /* ignore */ } this.dirs.delete(dk); }
  }

  closeAll() {
    for (const d of this.dirs.values()) {
      for (const e of d.files.values()) clearTimeout(e.timer);
      try { d.watcher && d.watcher.close(); } catch { /* ignore */ }
    }
    this.dirs.clear();
  }

  _onDirEvent(d, filename) {
    if (!filename) return this._checkAll(d);
    const e = d.files.get(key(path.join(d.dir, String(filename))));
    if (e) this._schedule(d, e);
    else if (d.files.size && d.files.size <= 3) this._checkAll(d); // renommage : le nouveau nom n'est pas connu
  }
  _checkAll(d) { for (const e of d.files.values()) this._schedule(d, e); }

  _schedule(d, entry) {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => this._check(d, entry).catch((err) => this.logger && this.logger.warn('Watcher check : ' + err.message)), this.debounceMs);
  }

  async _check(d, entry) {
    entry.timer = null;
    let st;
    try { st = await fsp.stat(entry.path); }
    catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') return;
      if (entry.state === 'missing') return;
      entry.state = 'missing';
      const moved = await this._findMoved(d, entry);
      if (moved) {
        d.files.delete(key(entry.path));
        const oldPath = entry.path;
        entry.path = moved.path; entry.known = { mtimeMs: moved.mtimeMs, size: moved.size, ino: moved.ino }; entry.state = 'present';
        d.files.set(key(entry.path), entry);
        this.onEvent({ path: oldPath, type: 'moved', newPath: moved.path, mtimeMs: moved.mtimeMs });
      } else {
        this.onEvent({ path: entry.path, type: 'deleted' });
      }
      return;
    }
    if (!st.isFile()) return;
    const k = entry.known;
    const differs = k.mtimeMs == null || Math.abs(st.mtimeMs - k.mtimeMs) > 1 || (k.size != null && st.size !== k.size);
    const reappeared = entry.state === 'missing';
    entry.state = 'present';
    if (differs || reappeared) {
      entry.known = { mtimeMs: st.mtimeMs, size: st.size, ino: st.ino };
      if (differs) this.onEvent({ path: entry.path, type: 'changed', mtimeMs: st.mtimeMs, size: st.size });
    }
  }

  /** Détecte un simple renommage dans le même dossier (même inode + même taille). */
  async _findMoved(d, entry) {
    if (!entry.known.ino) return null;
    try {
      const names = (await fsp.readdir(d.dir)).slice(0, 500);
      for (const n of names) {
        const full = path.join(d.dir, n);
        if (d.files.has(key(full))) continue;
        let st;
        try { st = await fsp.stat(full); } catch { continue; }
        if (st.isFile() && st.ino === entry.known.ino && st.size === entry.known.size) {
          return { path: full, mtimeMs: st.mtimeMs, size: st.size, ino: st.ino };
        }
      }
    } catch { /* ignore */ }
    return null;
  }
}

module.exports = { FileWatcher };
