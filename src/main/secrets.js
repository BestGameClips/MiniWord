'use strict';
const fs = require('fs');
const path = require('path');

/** Stockage chiffré (safeStorage de l'OS) pour le jeton GitHub. Jamais dans settings.json. */
class Secrets {
  constructor({ dir, safeStorage, logger }) { this.file = path.join(dir, 'secrets.bin'); this.ss = safeStorage; this.logger = logger; }
  available() { return !!(this.ss && this.ss.isEncryptionAvailable && this.ss.isEncryptionAvailable()); }
  getToken() {
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    try { if (this.available() && fs.existsSync(this.file)) return this.ss.decryptString(fs.readFileSync(this.file)); } catch (e) { this.logger.warn('Jeton illisible : ' + e.message); }
    return '';
  }
  hasToken() { return !!this.getToken(); }
  setToken(token) {
    if (!token) { try { fs.unlinkSync(this.file); } catch { /* ignore */ } return; }
    if (!this.available()) { const e = new Error('Le chiffrement du système n’est pas disponible : utilisez la variable d’environnement GITHUB_TOKEN.'); e.code = 'E_SECRET'; throw e; }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, this.ss.encryptString(token), { mode: 0o600 });
  }
}
module.exports = { Secrets };
