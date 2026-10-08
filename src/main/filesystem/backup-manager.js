'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

function pad(n, l = 2) { return String(n).padStart(l, '0'); }
function stamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`;
}

/**
 * Versions internes : avant d'écraser un fichier, une copie est stockée dans
 * <userData>/backups/<nom>-<hash>/<horodatage>_<nom>. Nettoyage automatique.
 */
class BackupManager {
  constructor({ dir, getKeep, getMaxAgeDays, minIntervalMs = 60000, logger }) {
    this.dir = dir;
    this.getKeep = getKeep || (() => 5);
    this.getMaxAgeDays = getMaxAgeDays || (() => 30);
    this.minIntervalMs = minIntervalMs;
    this.logger = logger;
    this.last = new Map();
  }

  folderFor(filePath) {
    const hash = crypto.createHash('sha1').update(path.resolve(filePath)).digest('hex').slice(0, 10);
    return path.join(this.dir, `${path.basename(filePath).replace(/[^\w.\-]+/g, '_')}-${hash}`);
  }

  /** Copie le fichier actuel avant écrasement. `force` ignore l'intervalle minimal (sauvegarde manuelle). */
  async backup(filePath, { force = false } = {}) {
    const now = Date.now();
    if (!force && now - (this.last.get(filePath) || 0) < this.minIntervalMs) return null;
    const folder = this.folderFor(filePath);
    await fsp.mkdir(folder, { recursive: true });
    const dest = path.join(folder, `${stamp()}_${path.basename(filePath)}`);
    await fsp.copyFile(filePath, dest);
    this.last.set(filePath, now);
    await this.cleanup(folder);
    return dest;
  }

  async list(filePath) {
    try { return (await fsp.readdir(this.folderFor(filePath))).sort().reverse(); } catch { return []; }
  }

  async cleanup(folder) {
    const keep = this.getKeep();
    let names;
    try { names = (await fsp.readdir(folder)).sort(); } catch { return; }
    for (const n of names.slice(0, Math.max(0, names.length - keep))) await fsp.unlink(path.join(folder, n)).catch(() => {});
  }

  /** Supprime les versions plus anciennes que N jours (au démarrage). */
  async purgeOld() {
    const limit = Date.now() - this.getMaxAgeDays() * 86400000;
    let folders;
    try { folders = await fsp.readdir(this.dir); } catch { return; }
    for (const f of folders) {
      const full = path.join(this.dir, f);
      let files;
      try { files = await fsp.readdir(full); } catch { continue; }
      for (const n of files) {
        const p = path.join(full, n);
        try { if ((await fsp.stat(p)).mtimeMs < limit) await fsp.unlink(p); } catch { /* ignore */ }
      }
      try { if ((await fsp.readdir(full)).length === 0) await fsp.rmdir(full); } catch { /* ignore */ }
    }
  }
}

module.exports = { BackupManager };
