'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * Récupération après crash : le renderer envoie des instantanés des documents
 * modifiés ; ils sont supprimés dès que le document est sauvegardé ou fermé volontairement.
 * Au prochain démarrage, ce qui reste = documents à récupérer.
 */
class RecoveryManager {
  constructor({ dir, logger }) { this.dir = dir; this.logger = logger; }

  _file(id) {
    if (!ID_RE.test(id)) throw Object.assign(new Error('Identifiant de récupération invalide.'), { code: 'E_ARG' });
    return path.join(this.dir, id + '.json');
  }

  async save(entry) {
    const file = this._file(entry.id);
    await fsp.mkdir(this.dir, { recursive: true });
    const data = JSON.stringify({
      id: entry.id, name: String(entry.name || ''), path: entry.path || null,
      content: String(entry.content), encoding: entry.encoding || 'utf8', eol: entry.eol === 'CRLF' ? 'CRLF' : 'LF',
      savedAt: Date.now(),
    });
    const tmp = file + '.tmp';
    await fsp.writeFile(tmp, data, 'utf8');
    await fsp.rename(tmp, file);
  }

  async list() {
    let names;
    try { names = await fsp.readdir(this.dir); } catch { return []; }
    const out = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      try {
        const e = JSON.parse(await fsp.readFile(path.join(this.dir, n), 'utf8'));
        out.push({ id: e.id, name: e.name, path: e.path, savedAt: e.savedAt, size: (e.content || '').length });
      } catch (err) { this.logger && this.logger.warn('Entrée de récupération illisible : ' + n); }
    }
    return out.sort((a, b) => a.savedAt - b.savedAt);
  }

  async get(id) {
    const e = JSON.parse(await fsp.readFile(this._file(id), 'utf8'));
    return e;
  }

  async clear(id) { await fsp.unlink(this._file(id)).catch(() => {}); }

  async clearAll() {
    let names;
    try { names = await fsp.readdir(this.dir); } catch { return; }
    await Promise.all(names.map((n) => fsp.unlink(path.join(this.dir, n)).catch(() => {})));
  }
}

module.exports = { RecoveryManager };
