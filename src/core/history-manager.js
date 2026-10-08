(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory()); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Historique Undo/Redo d'UN document (jamais partagé entre documents).
   * Les frappes rapprochées sont regroupées en une seule étape d'annulation.
   */
  class HistoryManager {
    constructor({ groupMs = 800, maxGroupMs = 5000, maxEntries = 200, maxChars = 20000000 } = {}) {
      this.groupMs = groupMs;
      this.maxGroupMs = maxGroupMs;
      this.maxEntries = maxEntries;
      this.maxChars = maxChars;
      this.states = [];
      this.index = -1;
      this.groupOpen = false;
      this.groupStart = 0;
      this.lastTime = 0;
      this.totalChars = 0;
    }

    get initialized() { return this.index >= 0; }
    get canUndo() { return this.index > 0; }
    get canRedo() { return this.index >= 0 && this.index < this.states.length - 1; }
    get current() { return this.states[this.index] || null; }

    reset(value, selStart = 0, selEnd = 0) {
      this.states = [{ value, selStart, selEnd }];
      this.index = 0;
      this.groupOpen = false;
      this.totalChars = value.length;
    }

    /** Enregistre un nouvel état. coalesce=true pour les frappes/suppressions. */
    record(value, selStart, selEnd, { coalesce = false, now = Date.now() } = {}) {
      const cur = this.current;
      if (!cur) return this.reset(value, selStart, selEnd);
      if (cur.value === value) { cur.selStart = selStart; cur.selEnd = selEnd; return; }

      const canGroup = coalesce && this.groupOpen && this.index === this.states.length - 1 &&
        now - this.lastTime < this.groupMs && now - this.groupStart < this.maxGroupMs && this.index > 0;
      if (canGroup) {
        this.totalChars += value.length - cur.value.length;
        this.states[this.index] = { value, selStart, selEnd };
      } else {
        const dropped = this.states.splice(this.index + 1);
        for (const s of dropped) this.totalChars -= s.value.length;
        this.states.push({ value, selStart, selEnd });
        this.index = this.states.length - 1;
        this.totalChars += value.length;
        this.groupStart = now;
        this._trim();
      }
      this.groupOpen = coalesce;
      this.lastTime = now;
    }

    undo() {
      if (!this.canUndo) return null;
      this.groupOpen = false;
      this.index--;
      return this.states[this.index];
    }

    redo() {
      if (!this.canRedo) return null;
      this.groupOpen = false;
      this.index++;
      return this.states[this.index];
    }

    _trim() {
      while (this.states.length > 2 && (this.states.length > this.maxEntries || this.totalChars > this.maxChars)) {
        const s = this.states.shift();
        this.totalChars -= s.value.length;
        this.index--;
      }
    }
  }

  return { HistoryManager };
});
