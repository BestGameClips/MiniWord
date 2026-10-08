(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Auto-save avec debounce : on ne sauvegarde JAMAIS à chaque frappe.
   * Chaque modification relance le minuteur ; la sauvegarde n'a lieu qu'après
   * `interval` ms sans nouvelle modification.
   */
  class AutosaveManager {
    constructor({ getInterval, canAutosave, save, timers } = {}) {
      this.getInterval = getInterval;
      this.canAutosave = canAutosave || (() => true);
      this.save = save;
      this.timers = timers || { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) };
      this.pending = new Map();
    }

    notifyChange(doc) {
      this.cancel(doc.id);
      const interval = this.getInterval();
      if (!interval || interval <= 0) return;
      if (!this.canAutosave(doc)) return;
      this.pending.set(doc.id, this.timers.setTimeout(() => this._run(doc), interval));
    }

    async _run(doc) {
      this.pending.delete(doc.id);
      if (!doc.isDirty || !this.canAutosave(doc)) return;
      try { await this.save(doc, { reason: 'autosave' }); } catch { /* l'erreur est gérée par save() */ }
    }

    cancel(id) {
      const t = this.pending.get(id);
      if (t !== undefined) { this.timers.clearTimeout(t); this.pending.delete(id); }
    }
    cancelAll() { for (const id of [...this.pending.keys()]) this.cancel(id); }
    has(id) { return this.pending.has(id); }
  }

  return { AutosaveManager };
});
