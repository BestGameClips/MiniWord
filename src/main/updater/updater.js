'use strict';
const { compareVersions } = require('../../shared/changelog');

/**
 * Mises à jour via GitHub Releases (electron-updater).
 * Actif si app.config.js › github.owner/repo sont renseignés ET que l'app est installée (packagée).
 * Le flux : check → (l'utilisateur accepte) → download (progression) → install au redémarrage.
 */
class Updater {
  constructor({ app, config, logger, onStatus }) {
    this.app = app; this.config = config; this.logger = logger; this.onStatus = onStatus || (() => {});
    this.au = null; this.state = { status: 'idle' };
  }
  get repo() { const g = this.config.github || {}; return g.owner && g.repo ? g : null; }
  get configured() { return !!(this.repo && this.config.updates && this.config.updates.enabled); }

  _set(state) { this.state = state; this.onStatus(state); }

  _load() {
    if (this.au) return this.au;
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.logger = { info: (m) => this.logger.debug('[updater] ' + m), warn: (m) => this.logger.warn('[updater] ' + m), error: (m) => this.logger.error('[updater] ' + m), debug() {} };
      autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = true; autoUpdater.allowPrerelease = false;
      autoUpdater.setFeedURL({ provider: 'github', owner: this.repo.owner, repo: this.repo.repo });
      autoUpdater.on('download-progress', (p) => this._set({ status: 'downloading', version: this.state.version, percent: Math.round(p.percent), bytesPerSecond: p.bytesPerSecond }));
      autoUpdater.on('update-downloaded', (i) => { this.logger.success('Mise à jour ' + i.version + ' téléchargée.'); this._set({ status: 'downloaded', version: i.version }); });
      autoUpdater.on('error', (e) => { this.logger.warn('Erreur de mise à jour : ' + e.message); this._set({ status: 'error', message: 'Échec de la mise à jour : ' + e.message }); });
      this.au = autoUpdater;
    } catch (err) { this.logger.warn('electron-updater indisponible : ' + err.message); }
    return this.au;
  }

  /** @returns {Promise<{status:string, message:string, version?:string}>} */
  async check() {
    if (!this.repo) return { status: 'disabled', message: 'Mises à jour non configurées : renseignez github.owner et github.repo dans app.config.js.' };
    if (!this.configured) return { status: 'disabled', message: 'Les mises à jour automatiques sont désactivées.' };
    if (!this.app.isPackaged) return { status: 'dev', message: 'Les mises à jour ne sont vérifiées que dans l’application installée.' };
    const au = this._load();
    if (!au) return { status: 'error', message: 'Le module de mise à jour est indisponible.' };
    try {
      this._set({ status: 'checking' });
      const res = await au.checkForUpdates();
      const info = res && res.updateInfo;
      if (info && compareVersions(info.version, this.app.getVersion()) > 0) {
        this.logger.success('Nouvelle version disponible : ' + info.version);
        const s = { status: 'available', version: info.version, message: `La version ${info.version} est disponible.`, notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '' };
        this._set(s); return s;
      }
      const s = { status: 'up-to-date', message: 'Vous utilisez la dernière version (' + this.app.getVersion() + ').' };
      this._set(s); return s;
    } catch (err) {
      this.logger.warn('Vérification des mises à jour échouée : ' + err.message);
      const s = { status: 'error', message: 'Impossible de vérifier les mises à jour (connexion ou dépôt).' };
      this._set(s); return s;
    }
  }

  async download() {
    if (this.state.status !== 'available') throw Object.assign(new Error('Aucune mise à jour à télécharger.'), { code: 'E_UPDATE' });
    this._set({ status: 'downloading', version: this.state.version, percent: 0 });
    await this._load().downloadUpdate();
  }

  install() {
    if (this.state.status !== 'downloaded') throw Object.assign(new Error('Aucune mise à jour téléchargée.'), { code: 'E_UPDATE' });
    this.au.quitAndInstall(false, true);
  }
}

module.exports = { Updater };
