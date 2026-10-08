(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../shared/utils'));
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory(root.MW)); }
})(typeof self !== 'undefined' ? self : this, function (U) {
  'use strict';

  /** Ordre, onglet actif, épinglage et pile des onglets fermés. Événement : change. */
  class TabManager extends U.Emitter {
    constructor({ maxClosed = 10 } = {}) {
      super();
      this.order = [];
      this.activeId = null;
      this.pinned = new Set();
      this.closed = [];
      this.maxClosed = maxClosed;
    }

    ids() { return [...this.order]; }
    has(id) { return this.order.includes(id); }
    indexOf(id) { return this.order.indexOf(id); }
    isPinned(id) { return this.pinned.has(id); }

    add(id, { activate = true, afterActive = false } = {}) {
      if (this.has(id)) return;
      let at = this.order.length;
      if (afterActive && this.activeId) at = this.order.indexOf(this.activeId) + 1;
      at = Math.max(at, this.pinned.size);
      this.order.splice(at, 0, id);
      if (activate || !this.activeId) this.activeId = id;
      this.emit('change', { type: 'add', id });
    }

    activate(id) {
      if (!this.has(id) || this.activeId === id) return;
      this.activeId = id;
      this.emit('change', { type: 'activate', id });
    }

    /** Retire l'onglet et renvoie l'id du nouvel onglet actif (ou null). */
    remove(id) {
      const i = this.order.indexOf(id);
      if (i < 0) return this.activeId;
      this.order.splice(i, 1);
      this.pinned.delete(id);
      if (this.activeId === id) this.activeId = this.order[Math.min(i, this.order.length - 1)] || null;
      this.emit('change', { type: 'remove', id });
      return this.activeId;
    }

    move(id, toIndex) {
      const from = this.order.indexOf(id);
      if (from < 0) return;
      const pinnedCount = this.pinned.size;
      const isP = this.pinned.has(id);
      const min = isP ? 0 : pinnedCount;
      const max = isP ? pinnedCount - 1 : this.order.length - 1;
      toIndex = U.clamp(toIndex, min, max);
      if (toIndex === from) return;
      this.order.splice(from, 1);
      this.order.splice(toIndex, 0, id);
      this.emit('change', { type: 'move', id });
    }

    togglePin(id) {
      if (!this.has(id)) return false;
      if (this.pinned.has(id)) this.pinned.delete(id); else this.pinned.add(id);
      // Les onglets épinglés restent regroupés à gauche (ordre relatif conservé)
      this.order = [...this.order.filter((x) => this.pinned.has(x)), ...this.order.filter((x) => !this.pinned.has(x))];
      this.emit('change', { type: 'pin', id });
      return this.pinned.has(id);
    }

    setPinned(id, value) { if (this.pinned.has(id) !== !!value) this.togglePin(id); }

    next() { return this._step(1); }
    prev() { return this._step(-1); }
    _step(d) {
      if (this.order.length < 2) return;
      const i = this.order.indexOf(this.activeId);
      this.activate(this.order[(i + d + this.order.length) % this.order.length]);
    }

    // Sélections pour fermetures groupées (les onglets épinglés sont épargnés)
    idsOthers(id) { return this.order.filter((x) => x !== id && !this.pinned.has(x)); }
    idsRight(id) { const i = this.order.indexOf(id); return i < 0 ? [] : this.order.slice(i + 1).filter((x) => !this.pinned.has(x)); }
    idsAll() { return this.order.filter((x) => !this.pinned.has(x)); }

    pushClosed(snapshot) { this.closed.push(snapshot); if (this.closed.length > this.maxClosed) this.closed.shift(); }
    popClosed() { return this.closed.pop() || null; }
  }

  return { TabManager };
});
