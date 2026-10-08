'use strict';
/**
 * ─────────────────────────────────────────────────────────────
 *  CONFIGURATION GLOBALE DE L'APPLICATION
 *  Change le nom ici (et dans electron-builder.yml → productName)
 *  pour renommer toute l'application.
 * ─────────────────────────────────────────────────────────────
 */
const pkg = require('./package.json');

module.exports = {
  appName: 'MiniWord',
  appId: 'com.miniword.app',
  version: pkg.version,
  description: 'Une application de traitement de texte légère pour ordinateur.',
  copyright: '© 2026 MiniWord',

  // Icône de fenêtre (Linux / dev). Remplace simplement le fichier pour changer le logo.
  windowIcon: 'assets/icons/icon.png',

  window: { width: 1180, height: 760, minWidth: 720, minHeight: 480 },

  limits: { maxFileSizeMB: 20 },

  /**
   * Dépôt GitHub utilisé pour : mises à jour (Releases), Wiki distant, notes de patch.
   * Renseigne owner + repo pour activer ces fonctions (laisse vide = 100 % hors ligne).
   */
  github: { owner: 'BestGameClips', repo: 'MiniWord', branch: 'main' },

  // Mises à jour via GitHub Releases (actives dès que github.owner/repo sont renseignés)
  updates: { enabled: true, checkOnStart: true },

  // Wiki : pages .md livrées (assets/wiki), synchronisées depuis GitHub (dossier `path` du dépôt), et pages locales.
  wiki: { remote: true, path: 'wiki', timeoutMs: 8000 },

  // Rôle administrateur du Wiki : SHA-256 du mot de passe (vide = seul le mode développeur donne l'accès).
  // Génère-le avec :  node -e "console.log(require('crypto').createHash('sha256').update('MON_MOT_DE_PASSE').digest('hex'))"
  admin: { passwordSha256: '' },
};
