'use strict';
const fs = require('fs');
const path = require('path');
const { sanitizeSettings, validateSettingsPatch, settingsDefaults } = require('../shared/settings-schema');

/** Paramètres utilisateur persistants (JSON dans le dossier userData, jamais dans le projet). */
class SettingsManager {
  constructor(filePath, logger) {
    this.filePath = filePath;
    this.logger = logger || { info() {}, warn() {}, error() {}, debug() {} };
    this.data = settingsDefaults();
    this._timer = null;
    this._listeners = new Set();
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      this.data = sanitizeSettings(JSON.parse(raw));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.logger.error('Fichier de paramètres illisible — réinitialisation (copie conservée).', err);
        try { fs.copyFileSync(this.filePath, this.filePath.replace(/\.json$/, '') + '.corrupt-' + Date.now() + '.json'); } catch { /* ignore */ }
      }
      this.data = settingsDefaults();
    }
    return this.data;
  }

  getAll() { return JSON.parse(JSON.stringify(this.data)); }
  get(key) { return this.data[key]; }

  set(patch) {
    const clean = validateSettingsPatch(patch, this.data);
    Object.assign(this.data, clean);
    this._scheduleSave();
    for (const fn of this._listeners) { try { fn(clean, this.data); } catch (e) { this.logger.error('Listener paramètres', e); } }
    return this.getAll();
  }

  /** Réinitialise les réglages (conserve récents, favoris, session par défaut). */
  reset({ keepData = true } = {}) {
    const keep = keepData ? { recentFiles: this.data.recentFiles, favorites: this.data.favorites, session: this.data.session } : {};
    this.data = Object.assign(settingsDefaults(), keep);
    this._scheduleSave();
    for (const fn of this._listeners) { try { fn(this.data, this.data); } catch (e) { this.logger.error('Listener paramètres', e); } }
    return this.getAll();
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _scheduleSave() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 300);
  }

  /** Écriture atomique (fichier temporaire puis renommage). */
  flush() {
    clearTimeout(this._timer);
    this._timer = null;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = this.filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      this.logger.error('Impossible d’enregistrer les paramètres.', err);
    }
  }
}

module.exports = { SettingsManager };
