(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../shared/utils'));
  else { root.MW = root.MW || {}; Object.assign(root.MW, factory(root.MW)); }
})(typeof self !== 'undefined' ? self : this, function (U) {
  'use strict';

  /**
   * Registre central des commandes (palette, raccourcis, menus, boutons).
   * command = { id, title, category, shortcut?, palette?=true, when?(), run(args) }
   */
  class CommandManager extends U.Emitter {
    constructor() { super(); this.commands = new Map(); this.recent = []; }

    register(cmd) {
      if (!cmd || !cmd.id || typeof cmd.run !== 'function') throw new Error('Commande invalide');
      if (this.commands.has(cmd.id)) throw new Error('Commande déjà enregistrée : ' + cmd.id);
      this.commands.set(cmd.id, Object.assign({ palette: true, category: 'Général' }, cmd));
    }
    registerAll(list) { for (const c of list) this.register(c); }
    get(id) { return this.commands.get(id) || null; }
    all() { return [...this.commands.values()]; }

    isAvailable(cmd) { try { return !cmd.when || !!cmd.when(); } catch { return false; } }

    async execute(id, args) {
      const cmd = this.commands.get(id);
      if (!cmd) throw new Error('Commande inconnue : ' + id);
      this.recent = [id, ...this.recent.filter((x) => x !== id)].slice(0, 8);
      this.emit('executed', id);
      return cmd.run(args);
    }

    /** Commandes visibles dans la palette, filtrées/triées par pertinence. */
    search(query) {
      let q = String(query || '').trim().toLowerCase();
      const slash = q.startsWith('/');
      if (slash) q = q.slice(1);
      const avail = this.all().filter((c) => c.palette !== false && this.isAvailable(c));
      if (!q && !slash) {
        const rank = (c) => { const i = this.recent.indexOf(c.id); return i < 0 ? 999 : i; };
        return avail.slice().sort((a, b) => rank(a) - rank(b));
      }
      const scored = [];
      for (const c of avail) {
        let s = CommandManager.score(q, (c.category + ' ' + c.title).toLowerCase(), c.title.toLowerCase());
        for (const a of c.aliases || []) { const al = a.replace(/^\//, '').toLowerCase(); if (al === q) s = Math.max(s, 2000); else if (al.startsWith(q)) s = Math.max(s, 900); }
        if (slash && !(c.aliases || []).length) s = 0;
        if (s > 0) scored.push([s, c]);
      }
      return scored.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
    }

    static score(q, haystack, title) {
      if (title === q) return 1000;
      if (title.startsWith(q)) return 800;
      const idx = title.indexOf(q);
      if (idx >= 0) return 600 - idx;
      if (haystack.includes(q)) return 400;
      // sous-séquence ("nvdoc" → "nouveau document")
      let qi = 0, gaps = 0, last = -1;
      for (let i = 0; i < title.length && qi < q.length; i++) {
        if (title[i] === q[qi]) { if (last >= 0 && i - last > 1) gaps++; last = i; qi++; }
      }
      return qi === q.length ? 200 - gaps : 0;
    }
  }

  return { CommandManager };
});
