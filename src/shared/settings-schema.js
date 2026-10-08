(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./constants'), require('./utils'));
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory(root.MW, root.MW)); }
})(typeof self !== 'undefined' ? self : this, function (C, U) {
  'use strict';

  const INVALID = Symbol('invalid');

  // ── Validateurs : renvoient la valeur nettoyée ou INVALID ──
  const V = {
    bool: () => (v) => (typeof v === 'boolean' ? v : INVALID),
    enum: (list) => (v) => (list.includes(v) ? v : INVALID),
    int: (min, max) => (v) => (Number.isInteger(v) && v >= min && v <= max ? v : INVALID),
    num: (min, max) => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : INVALID),
    color: () => (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : INVALID),
    str: (max, re) => (v) => (typeof v === 'string' && v.length <= max && (!re || re.test(v)) ? v : INVALID),
    nullable: (inner) => (v) => (v === null ? null : inner(v)),
    arrayOf: (inner, max) => (v) => {
      if (!Array.isArray(v) || v.length > max) return INVALID;
      const out = [];
      for (const item of v) { const r = inner(item); if (r !== INVALID) out.push(r); }
      return out;
    },
    record: (inner, maxKeys) => (v) => {
      if (!U.isPlainObject(v) || Object.keys(v).length > maxKeys) return INVALID;
      const out = {};
      for (const [k, val] of Object.entries(v)) { if (k.length > 64) continue; const r = inner(val); if (r !== INVALID) out[k] = r; }
      return out;
    },
    shape: (shape) => (v) => {
      if (!U.isPlainObject(v)) return INVALID;
      const out = {};
      for (const [k, fn] of Object.entries(shape)) {
        if (!(k in v)) continue;
        const r = fn(v[k]);
        if (r === INVALID) return INVALID;
        out[k] = r;
      }
      return out;
    },
  };

  const pathStr = V.str(4096);
  const recentEntry = V.shape({ path: pathStr, name: V.str(512), type: V.str(32), openedAt: V.num(0, 1e15) });
  const favoriteEntry = V.shape({ path: pathStr, name: V.str(512), addedAt: V.num(0, 1e15) });

  const DISCORD_DEFAULTS = {
    enabled: true,
    showFileName: true,
    showFolder: true,
    showPath: false,
    showFullPath: false,
    showTime: true,
    showStatus: true,
    showExtension: true,
    resetTimerOnChange: true,
    showIcon: false,
    showTabs: false,
  };

  /** Chaque clé : { default, validate, merge? } */
  const SCHEMA = {
    theme: { default: 'dark', validate: V.enum(['dark', 'light', 'system']) },
    accentColor: { default: '#6b7cff', validate: V.color() },
    language: { default: 'fr', validate: V.enum(['fr']) },

    sidebarCollapsed: { default: false, validate: V.bool() },
    sidebarRecentOpen: { default: true, validate: V.bool() },
    sidebarFavoritesOpen: { default: true, validate: V.bool() },
    statusBarVisible: { default: true, validate: V.bool() },

    font: { default: C.FONT_CHOICES[0].value, validate: V.enum(C.FONT_CHOICES.map((f) => f.value)) },
    fontSize: { default: 15, validate: V.int(8, 48) },
    lineHeight: { default: 1.6, validate: V.num(1, 3) },
    zoom: { default: 100, validate: V.enum(C.ZOOM_LEVELS) },
    wordWrap: { default: true, validate: V.bool() },
    showInvisibles: { default: false, validate: V.bool() },
    tabSize: { default: 4, validate: V.int(1, 16) },
    insertSpaces: { default: true, validate: V.bool() },

    density: { default: 'normal', validate: V.enum(['compact', 'normal', 'comfortable']) },
    radius: { default: 8, validate: V.int(0, 16) },
    animations: { default: true, validate: V.bool() },

    autosaveInterval: { default: 2000, validate: V.enum(C.AUTOSAVE_INTERVALS.map((a) => a.value)) },
    backupEnabled: { default: true, validate: V.bool() },
    backupKeep: { default: 5, validate: V.int(1, 50) },
    backupMaxAgeDays: { default: 30, validate: V.int(1, 365) },

    recentLimit: { default: 15, validate: V.int(1, 50) },
    recentFiles: { default: [], validate: V.arrayOf(recentEntry, 100) },
    favorites: { default: [], validate: V.arrayOf(favoriteEntry, 200) },
    restoreSession: { default: true, validate: V.bool() },
    session: {
      default: { tabs: [], active: null },
      validate: V.shape({
        tabs: V.arrayOf(V.shape({ path: pathStr, pinned: V.bool() }), 100),
        active: V.nullable(pathStr),
      }),
    },

    shortcuts: { default: {}, validate: V.record(V.str(40, /^[A-Za-z0-9+/\-_,.;'\[\]\\` ]*$/), 300) },
    windowBounds: {
      default: null,
      validate: V.nullable(V.shape({ x: V.int(-100000, 100000), y: V.int(-100000, 100000), width: V.int(100, 100000), height: V.int(100, 100000) })),
    },
    windowMaximized: { default: false, validate: V.bool() },
    developerMode: { default: false, validate: V.bool() },
    showLineNumbers: { default: false, validate: V.bool() },
    mdPreviewTheme: { default: 'neon', validate: V.enum(['neon', 'glass', 'paper']) },
    wikiStorage: { default: 'files', validate: V.enum(['files', 'sqlite']) },
    wikiGithubSync: { default: false, validate: V.bool() },
    lastSeenVersion: { default: '', validate: V.str(40) },
    discordClientId: { default: '', validate: V.str(25, /^\d*$/) },
    showWhatsNew: { default: true, validate: V.bool() },

    discordRPC: {
      default: DISCORD_DEFAULTS,
      merge: true,
      validate: V.shape({
        enabled: V.bool(), showFileName: V.bool(), showFolder: V.bool(), showPath: V.bool(), showFullPath: V.bool(),
        showTime: V.bool(), showStatus: V.bool(), showExtension: V.bool(), resetTimerOnChange: V.bool(), showIcon: V.bool(), showTabs: V.bool(),
      }),
    },
  };

  function defaults() {
    const out = {};
    for (const [k, r] of Object.entries(SCHEMA)) out[k] = U.deepClone(r.default);
    return out;
  }

  /** Nettoie un objet de paramètres arbitraire (fichier corrompu / ancienne version). */
  function sanitizeAll(raw) {
    const out = defaults();
    if (!U.isPlainObject(raw)) return out;
    for (const [k, rule] of Object.entries(SCHEMA)) {
      if (!(k in raw)) continue;
      let v = raw[k];
      if (rule.merge && U.isPlainObject(v)) v = Object.assign({}, rule.default, v);
      const r = rule.validate(v);
      if (r !== INVALID) out[k] = rule.merge ? Object.assign({}, rule.default, r) : r;
    }
    return out;
  }

  /** Valide un patch partiel. Lève une Error si une clé/valeur est invalide. */
  function validatePatch(patch, current) {
    if (!U.isPlainObject(patch)) throw new Error('Paramètres invalides.');
    const out = {};
    for (const [k, v0] of Object.entries(patch)) {
      const rule = SCHEMA[k];
      if (!rule) throw new Error('Paramètre inconnu : ' + k);
      const v = rule.merge && U.isPlainObject(v0) ? Object.assign({}, current ? current[k] : rule.default, v0) : v0;
      const r = rule.validate(v);
      if (r === INVALID) throw new Error('Valeur invalide pour « ' + k + ' ».');
      out[k] = r;
    }
    return out;
  }

  return { SETTINGS_SCHEMA: SCHEMA, SETTINGS_INVALID: INVALID, settingsDefaults: defaults, sanitizeSettings: sanitizeAll, validateSettingsPatch: validatePatch, DISCORD_DEFAULTS };
});
