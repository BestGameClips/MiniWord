'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                  DISCORD RICH PRESENCE — MiniWord                    ║
 * ║                                                                      ║
 * ║  ➜ TOUT SE MODIFIE DANS LE BLOC « CONFIG » CI-DESSOUS.               ║
 * ║  Le reste du fichier est la logique (connexion, envoi, anti-spam).   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Mise en route (2 minutes) :
 *   1. Va sur https://discord.com/developers/applications → « New Application ».
 *   2. Le NOM que tu donnes à l'application est celui qui s'affiche sur ton profil
 *      (« Joue à MiniWord »). Mets par exemple « MiniWord ».
 *   3. Copie l'« Application ID » (onglet General Information) et colle-le dans
 *      CONFIG.clientId ci-dessous.
 *   4. (Optionnel) Rich Presence → Art Assets : envoie une image nommée « logo »
 *      (512×512 min.) pour qu'elle apparaisse en grand sur ton profil.
 *   5. Lance Discord (application de bureau, pas le navigateur) puis MiniWord.
 *
 * Variables disponibles dans les textes (entre accolades) :
 *   {appName}   nom de l'application             {icon}      emoji du statut
 *   {label}     libellé du statut                {file}      nom du fichier (selon réglages)
 *   {location}  « · 📁 Dossier » (selon réglages) {locationRaw} dossier/chemin sans décoration
 *   {tabs}      nombre d'onglets ouverts         {ext}       extension (ex. txt)
 *   {tabsText}  « · 3 onglets » (si activé)      {type}      type de fichier (ex. Markdown)
 *
 * Après modification : relance simplement `npm run dev`. Pour l'exécutable installé,
 * recompile avec `npm run dist` — OU utilise le fichier d'override (voir plus bas
 * « discord-rpc.override.json »), pris en compte sans recompiler.
 */

// ════════════════════════════════════════════════════════════════════════
//                               CONFIG
// ════════════════════════════════════════════════════════════════════════
const CONFIG = {
  // ID de ton application Discord (obligatoire). Peut aussi être donné par la variable
  // d'environnement MINIWORD_DISCORD_CLIENT_ID.
  clientId: '1557397337280876544',

  // Nom affiché via {appName}
  appName: 'MiniWord',

  // Délai avant une nouvelle tentative de connexion si Discord n'est pas lancé (ms)
  reconnectDelayMs: 15000,

  // Intervalle minimum entre deux envois à Discord (limite Discord : 5 mises à jour / 20 s)
  minUpdateIntervalMs: 2000,

  // Masquer le dossier personnel dans les chemins (C:\Users\Toi\Docs → ~\Docs)
  maskHomeDirectory: true,

  // Longueur maximale d'un chemin affiché (coupé au début avec « … »)
  maxPathLength: 70,

  // ── Icônes dynamiques par type de fichier (petite image, activable dans Paramètres › Discord › « Icône du type de fichier ») ──
  // `key` = nom d'une image envoyée dans « Rich Presence → Art Assets » de TON application Discord.
  // Une clé absente de tes assets = pas d'icône (aucune erreur). Ajoute/retire librement des extensions.
  fileTypeIcons: {
    default: { key: 'file',       text: 'Document' },
    txt:     { key: 'txt',        text: 'Texte brut' },
    md:      { key: 'markdown',   text: 'Markdown' },
    json:    { key: 'json',       text: 'JSON' },
    js:      { key: 'javascript', text: 'JavaScript' },
    ts:      { key: 'typescript', text: 'TypeScript' },
    html:    { key: 'html',       text: 'HTML' },
    css:     { key: 'css',        text: 'CSS' },
    csv:     { key: 'csv',        text: 'CSV' },
    xml:     { key: 'xml',        text: 'XML' },
    log:     { key: 'log',        text: 'Journal' },
  },

  // Images (clés de « Rich Presence → Art Assets » de ton application Discord, ou URL https)
  images: {
    largeKey: 'logo',
    largeText: '{appName}', // texte au survol de la grande image
  },

  // Textes par statut. Mets '' pour masquer une ligne.
  //   details = 2e ligne (sous le nom)   state = 3e ligne
  statuses: {
    idle:      { icon: '📝', label: 'Prêt',        details: '{icon} {label}', state: 'Aucun document', smallKey: '', smallText: '' },
    reading:   { icon: '📄', label: 'Lecture',     details: '{icon} {label}', state: '{file}{location}', smallKey: '', smallText: '' },
    editing:   { icon: '✏️', label: 'Édition',     details: '{icon} {label}', state: '{file}{location}', smallKey: '', smallText: '' },
    saving:    { icon: '💾', label: 'Sauvegarde',  details: '{icon} {label}', state: '{file}{location}', smallKey: '', smallText: '' },
    searching: { icon: '🔍', label: 'Recherche',   details: '{icon} {label}', state: '{file}{location}', smallKey: '', smallText: '' },
  },

  // Formats annexes
  formats: {
    location: ' · 📁 {value}',      // ajouté à {file} via {location}
    untitledName: 'Nouveau document', // nom affiché pour un document non enregistré
    hiddenFileName: 'Document',       // quand « Afficher le nom du fichier » est désactivé
    // Quand « Afficher le statut d'édition » est désactivé :
    noStatusDetails: '{file}',
    noStatusState: '{locationRaw}',
  },

  // Boutons sous le statut (2 maximum, URL https obligatoire). Exemple :
  // buttons: [{ label: 'Mon site', url: 'https://example.com' }],
  buttons: [],
};
// ════════════════════════════════════════════════════════════════════════
//                          FIN DE LA CONFIG
// ════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { basename, dirname, stripExtension, extname, truncateMiddle, truncateEnd, isPlainObject } = require('../../shared/utils');

const PLACEHOLDER_ID = '1557397337280876544';
const VALID_STATUSES = ['idle', 'reading', 'editing', 'saving', 'searching'];

/** Fusion profonde (override JSON → CONFIG). */
function mergeConfig(base, extra) {
  if (!isPlainObject(extra)) return base;
  for (const [k, v] of Object.entries(extra)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (isPlainObject(v) && isPlainObject(base[k])) mergeConfig(base[k], v);
    else base[k] = v;
  }
  return base;
}

function render(template, vars) {
  return String(template || '')
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function maskHome(p, cfg) {
  if (!cfg.maskHomeDirectory) return p;
  const home = os.homedir();
  if (home && p.toLowerCase().startsWith(home.toLowerCase())) return '~' + p.slice(home.length);
  return p;
}

/**
 * Construit l'activité Discord (fonction pure, testable).
 * Ne reçoit JAMAIS le contenu du document : uniquement nom, chemin, statut.
 */
function buildActivity(payload, rpcSettings, cfg, timerStart) {
  const s = rpcSettings;
  const status = VALID_STATUSES.includes(payload && payload.status) ? payload.status : 'idle';
  const hasDoc = status !== 'idle' && payload && (payload.fileName || payload.filePath || payload.isUntitled);
  const st = cfg.statuses[status] || cfg.statuses.idle;

  const tabCount = (payload && payload.tabCount) || 0;
  const vars = { appName: cfg.appName, icon: st.icon, label: st.label, tabs: tabCount, tabsText: s.showTabs && tabCount > 1 && status !== 'idle' ? ' · ' + tabCount + ' onglets' : '', file: '', ext: '', type: '', location: '', locationRaw: '' };
  const ftype = hasDoc && payload.filePath ? ((cfg.fileTypeIcons || {})[extname(payload.filePath)] || (cfg.fileTypeIcons || {}).default) : (hasDoc ? (cfg.fileTypeIcons || {}).default : null);
  if (ftype) vars.type = ftype.text;

  if (hasDoc) {
    const rawName = payload.filePath ? basename(payload.filePath) : (payload.fileName || cfg.formats.untitledName);
    if (!s.showFileName) vars.file = cfg.formats.hiddenFileName;
    else vars.file = s.showExtension ? rawName : stripExtension(rawName);
    if (s.showFileName && payload.filePath) vars.ext = extname(payload.filePath);

    if (payload.filePath) {
      const full = maskHome(payload.filePath, cfg);
      if (s.showPath) {
        vars.locationRaw = s.showFullPath ? full : maskHome(dirname(payload.filePath), cfg);
      } else if (s.showFolder) {
        vars.locationRaw = basename(dirname(payload.filePath)) || dirname(payload.filePath);
      }
      if (vars.locationRaw) vars.locationRaw = truncateMiddle(vars.locationRaw, cfg.maxPathLength);
    }
    if (vars.locationRaw) vars.location = String(cfg.formats.location).replace('{value}', vars.locationRaw);
  }

  const withTabs = (t) => (s.showTabs && vars.tabsText && !/\{tabsText\}/.test(t) ? t + '{tabsText}' : t);
  const activityLines = s.showStatus || !hasDoc
    ? { details: render(st.details, vars), state: render(withTabs(st.state), vars) }
    : { details: render(cfg.formats.noStatusDetails, vars), state: render(cfg.formats.noStatusState, vars) };

  const clean = (t) => { t = truncateEnd(t, 128); return t.length >= 2 ? t : undefined; };
  const activity = {
    details: clean(activityLines.details),
    state: clean(activityLines.state),
    largeImageKey: cfg.images.largeKey || undefined,
    largeImageText: clean(render(cfg.images.largeText, vars)),
    smallImageKey: st.smallKey || (s.showIcon && ftype ? ftype.key : undefined) || undefined,
    smallImageText: st.smallKey ? clean(render(st.smallText, vars)) : (s.showIcon && ftype ? clean(ftype.text) : undefined),
    instance: false,
  };
  if (s.showTime && timerStart) activity.startTimestamp = new Date(timerStart);
  const buttons = (cfg.buttons || []).filter((b) => b && b.label && /^https:\/\//.test(b.url || '')).slice(0, 2).map((b) => ({ label: String(b.label).slice(0, 32), url: b.url }));
  if (buttons.length) activity.buttons = buttons;
  for (const k of Object.keys(activity)) if (activity[k] === undefined) delete activity[k];
  return activity;
}

class DiscordRPC extends EventEmitter {
  /**
   * @param {{settings: object, logger: object, userDataDir?: string, config?: object}} opts
   */
  constructor({ settings, logger, userDataDir, config }) {
    super();
    this.settings = settings;
    this.logger = logger;
    this.userDataDir = userDataDir;
    this.cfg = config || JSON.parse(JSON.stringify(CONFIG));
    this.client = null;
    this.status = 'disabled'; // disabled | not-configured | connecting | connected | error
    this.statusMessage = '';
    this.payload = { status: 'idle', tabCount: 0 };
    this.appStart = Date.now();
    this.timerStart = this.appStart;
    this.lastDocId = null;
    this.lastKey = '';
    this.lastSent = 0;
    this.sendTimer = null;
    this.reconnectTimer = null;
    this.connecting = false;
    this.destroyed = false;
  }

  get overridePath() { return this.userDataDir ? path.join(this.userDataDir, 'discord-rpc.override.json') : null; }
  get rpcSettings() { return this.settings.get('discordRPC'); }
  /** Priorité : variable d'environnement > Client ID saisi dans les paramètres > CONFIG.clientId */
  get clientId() { return process.env.MINIWORD_DISCORD_CLIENT_ID || this.settings.get('discordClientId') || this.cfg.clientId; }

  _setStatus(status, message = '') {
    if (this.status === status && this.statusMessage === message) return;
    this.status = status; this.statusMessage = message;
    this.emit('status', this.getStatus());
  }
  getStatus() { return { state: this.status, message: this.statusMessage, clientIdConfigured: !!this.clientId && this.clientId !== PLACEHOLDER_ID }; }

  _loadOverride() {
    const p = this.overridePath;
    if (!p) return;
    try {
      if (fs.existsSync(p)) {
        mergeConfig(this.cfg, JSON.parse(fs.readFileSync(p, 'utf8')));
        this.logger.info('Override Discord RPC chargé : ' + p);
      }
    } catch (err) { this.logger.warn('discord-rpc.override.json invalide : ' + err.message); }
  }

  init() {
    this._loadOverride();
    this.applySettings();
  }

  /** À appeler quand les réglages Discord changent. */
  applySettings() {
    if (this.destroyed) return;
    if (!this.rpcSettings.enabled) {
      this._disconnect().catch(() => {});
      this._setStatus('disabled');
      return;
    }
    if (this._connectedId && this._connectedId !== this.clientId) { this.reconnect().catch(() => {}); return; } // Client ID changé dans les paramètres
    if (this.status === 'connected') { this.lastKey = ''; this._scheduleSend(true); }
    else if (!this.connecting) this._connect();
  }

  /** Reçoit l'état du document actif (jamais son contenu). */
  setPresence(payload) {
    this.payload = payload;
    if (payload.docId !== this.lastDocId) {
      if (this.rpcSettings.resetTimerOnChange && this.lastDocId !== null && payload.docId) this.timerStart = Date.now();
      this.lastDocId = payload.docId || null;
    }
    this._scheduleSend();
  }

  clear() {
    this.payload = { status: 'idle', tabCount: 0 };
    this.lastDocId = null;
    this._scheduleSend(true);
  }

  getPreview() { return buildActivity(this.payload, this.rpcSettings, this.cfg, this.timerStart); }

  async reconnect() {
    clearTimeout(this.reconnectTimer);
    await this._disconnect();
    this._loadOverride();
    if (this.rpcSettings.enabled) await this._connect();
  }

  // ── Connexion ──
  async _connect() {
    if (this.destroyed || this.connecting || !this.rpcSettings.enabled) return;
    const id = this.clientId;
    if (!id || id === PLACEHOLDER_ID) {
      this._setStatus('not-configured', 'Aucun Client ID : saisissez-le dans Paramètres › Discord (ou dans CONFIG.clientId).');
      return;
    }
    this.connecting = true;
    this._setStatus('connecting');
    let Client;
    try { ({ Client } = require('@xhayper/discord-rpc')); }
    catch (err) {
      this.connecting = false;
      this.logger.error('Module @xhayper/discord-rpc introuvable (lance « npm install »).', err);
      this._setStatus('error', 'Module Discord RPC manquant (npm install).');
      return;
    }
    const client = new Client({ clientId: id });
    this.client = client;
    client.on('ready', () => {
      if (this.client !== client) return;
      this.connecting = false; this._connectedId = id;
      this._setStatus('connected');
      (this.logger.success || this.logger.info).call(this.logger, 'Discord RPC connecté.');
      this.lastKey = '';
      this._scheduleSend(true);
    });
    client.on('disconnected', () => {
      if (this.client !== client || this.destroyed) return;
      this.logger.info('Discord RPC déconnecté.');
      this.client = null; this.connecting = false;
      this._setStatus('error', 'Déconnecté de Discord.');
      this._scheduleReconnect();
    });
    try {
      await client.login();
    } catch (err) {
      if (this.client === client) this.client = null;
      this.connecting = false;
      try { await client.destroy(); } catch { /* ignore */ }
      this.logger.debug('Discord RPC : connexion impossible (' + (err && err.message) + ')');
      this._setStatus('error', 'Discord n’est pas lancé ou inaccessible.');
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.destroyed || !this.rpcSettings.enabled) return;
    this.reconnectTimer = setTimeout(() => this._connect(), this.cfg.reconnectDelayMs);
    if (this.reconnectTimer.unref) this.reconnectTimer.unref();
  }

  async _disconnect() {
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.sendTimer);
    this.sendTimer = null;
    const c = this.client;
    this.client = null; this.connecting = false; this.lastKey = ''; this._connectedId = null;
    if (c) {
      try { if (c.user) await c.user.clearActivity(); } catch { /* ignore */ }
      try { await c.destroy(); } catch { /* ignore */ }
    }
  }

  // ── Envoi (anti-spam + dédoublonnage) ──
  _scheduleSend(immediate = false) {
    if (this.destroyed || this.status !== 'connected') return;
    const wait = Math.max(0, this.cfg.minUpdateIntervalMs - (Date.now() - this.lastSent));
    clearTimeout(this.sendTimer);
    this.sendTimer = setTimeout(() => this._send(), immediate ? Math.min(wait, 300) : wait);
  }

  async _send() {
    this.sendTimer = null;
    if (!this.client || !this.client.user || this.status !== 'connected') return;
    const activity = this.getPreview();
    // Le timestamp change à chaque calcul si le timer est réinitialisé : on le compare via sa valeur
    const key = JSON.stringify(activity);
    if (key === this.lastKey) return; // rien n'a changé → on n'envoie rien
    this.lastKey = key; this.lastSent = Date.now();
    try { await this.client.user.setActivity(activity); }
    catch (err) {
      this.lastKey = '';
      this.logger.warn('Discord RPC : envoi impossible (' + (err && err.message) + ')');
    }
  }

  /** Arrêt propre à la fermeture de l'application. */
  async shutdown() {
    this.destroyed = true;
    await this._disconnect();
    this._setStatus('disabled');
  }
}

module.exports = { DiscordRPC, buildActivity, CONFIG, render, mergeConfig };
