(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../shared/utils'));
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory(root.MW)); }
})(typeof self !== 'undefined' ? self : this, function (U) {
  'use strict';

  /** Raccourcis gérés nativement par le champ de texte (non interceptés) — réservés. */
  const RESERVED = {
    'Ctrl+A': 'Tout sélectionner', 'Ctrl+C': 'Copier', 'Ctrl+X': 'Couper', 'Ctrl+V': 'Coller',
  };
  const KEY_NAMES = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ' ': 'Space', '+': 'Plus', '=': 'Plus', '-': 'Minus', Esc: 'Escape' };

  /**
   * Gestion centralisée et configurable des raccourcis clavier.
   * Les surcharges utilisateur ({commandId: 'Ctrl+Shift+X' | ''}) priment sur les défauts.
   */
  class ShortcutManager extends U.Emitter {
    constructor({ commands, getOverrides, isMac = false } = {}) {
      super();
      this.commands = commands;
      this.getOverrides = getOverrides || (() => ({}));
      this.isMac = isMac;
      this.suspended = false;
      this.blocked = () => false;
      this._map = null;
    }

    /** KeyboardEvent → "Ctrl+Shift+P" (ou null si touche modificatrice seule). */
    static normalizeEvent(e, isMac = false) {
      let k = e.key;
      if (!k || ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'Dead', 'Unidentified'].includes(k)) return null;
      if (e.getModifierState && e.getModifierState('AltGraph')) return null; // saisie de caractères (AltGr)
      const ctrl = isMac ? e.metaKey || e.ctrlKey : e.ctrlKey;
      const meta = isMac ? false : e.metaKey;
      let shift = e.shiftKey;
      if (e.altKey && k.length === 1 && e.code && /^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
      if (KEY_NAMES[k]) { if (k === '+' || k === '=' || k === '-') shift = false; k = KEY_NAMES[k]; }
      else if (k.length === 1) {
        if (/[a-zA-Z]/.test(k)) k = k.toUpperCase();
        else shift = false; // chiffres/symboles : Shift fait partie de la frappe (clavier AZERTY)
      }
      const mods = [];
      if (ctrl) mods.push('Ctrl');
      if (meta) mods.push('Meta');
      if (e.altKey) mods.push('Alt');
      if (shift) mods.push('Shift');
      return [...mods, k].join('+');
    }

    static format(accel, isMac = false) {
      if (!accel) return '';
      return accel.split('+').map((p, i, arr) => {
        if (p === 'Plus') return '+';
        if (p === 'Minus') return '-';
        if (p === 'Ctrl' && isMac) return '⌘';
        if (p === 'Escape') return 'Échap';
        return p;
      }).join(isMac ? '' : '+').replace(/\+\+\+/, '++');
    }

    invalidate() { this._map = null; this.emit('change'); }

    getBinding(id) {
      const ov = this.getOverrides();
      if (Object.prototype.hasOwnProperty.call(ov, id)) return ov[id];
      const c = this.commands.get(id);
      return c && c.shortcut ? c.shortcut : '';
    }
    getDefault(id) { const c = this.commands.get(id); return c && c.shortcut ? c.shortcut : ''; }
    isCustomized(id) { return Object.prototype.hasOwnProperty.call(this.getOverrides(), id); }

    buildMap() {
      const map = new Map();
      for (const c of this.commands.all()) {
        const a = this.getBinding(c.id);
        if (a && !map.has(a)) map.set(a, c.id);
      }
      this._map = map;
      return map;
    }

    /** Commande(s) en conflit avec cet accélérateur. */
    findConflict(accel, exceptId) {
      if (!accel) return null;
      if (RESERVED[accel]) return { reserved: true, title: RESERVED[accel] };
      for (const c of this.commands.all()) {
        if (c.id !== exceptId && this.getBinding(c.id) === accel) return { id: c.id, title: c.title };
      }
      return null;
    }

    /** Gestionnaire keydown global. Renvoie true si l'évènement a été consommé. */
    handleKeydown(e) {
      if (this.suspended || this.blocked(e)) return false;
      const accel = ShortcutManager.normalizeEvent(e, this.isMac);
      if (!accel) return false;
      if (!this._map) this.buildMap();
      const id = this._map.get(accel);
      if (!id) return false;
      e.preventDefault();
      e.stopPropagation();
      Promise.resolve(this.commands.execute(id)).catch((err) => this.emit('error', err, id));
      return true;
    }
  }

  return { ShortcutManager, RESERVED_SHORTCUTS: RESERVED };
});
