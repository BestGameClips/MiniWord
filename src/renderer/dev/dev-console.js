(function () {
  const MW = window.MW; const { h, icon } = MW;
  const LEVELS = [['success', 'Succès'], ['info', 'Info'], ['warn', 'Avert.'], ['error', 'Erreurs'], ['debug', 'Debug']];
  const MAX = 1500;

  const C = {
    active: false, entries: [], filters: new Set(['success', 'info', 'warn', 'error', 'debug']), paused: false, buffer: [], unsub: null, el: null, list: null, counts: {},

    /** Disponible uniquement en mode développeur (ou en `npm run dev`). */
    available() { return !!(MW.Store.info && (MW.Store.info.isDev || MW.Store.settings.developerMode)); },

    async toggle() {
      if (!this.available()) { MW.notify.info('Activez le mode développeur : Paramètres › Avancé.'); return; }
      this.active ? this.close() : await this.open();
    },

    async open() {
      this.active = true;
      const panel = document.getElementById('dev-panel'); panel.hidden = false; this.el = panel;
      try { this.entries = (await window.api.dev.history()).slice(-MAX); } catch (e) { this.entries = []; MW.notify.warn(e.message); }
      this.unsub && this.unsub();
      this.unsub = window.api.dev.onLog((e) => this.push(e));
      this.build();
    },
    close() { this.active = false; this.unsub && this.unsub(); this.unsub = null; this.el.hidden = true; MW.clear(this.el); },

    push(e) {
      if (this.paused) { this.buffer.push(e); return; }
      this.entries.push(e); if (this.entries.length > MAX) this.entries.shift();
      if (this.filters.has(e.level)) this.appendLine(e, true);
      this.updateCounts();
    },

    fmtTime(ts) { const d = new Date(ts); const p = (n, l = 2) => String(n).padStart(l, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3); },

    appendLine(e, stick) {
      const l = this.list;
      const atEnd = l.scrollTop + l.clientHeight >= l.scrollHeight - 30;
      const row = h('div', { class: 'log-line lv-' + e.level }, h('span', { class: 'log-time' }, this.fmtTime(e.ts)), h('span', { class: 'log-lvl' }, e.level.toUpperCase()), h('span', { class: 'log-src' }, e.source), h('span', { class: 'log-msg' }, e.message + (e.stack ? '\n' + e.stack : '')));
      l.append(row);
      while (l.children.length > MAX) l.firstChild.remove();
      if (stick && atEnd) l.scrollTop = l.scrollHeight;
    },

    renderAll() { MW.clear(this.list); this.entries.filter((e) => this.filters.has(e.level)).forEach((e) => this.appendLine(e, false)); this.list.scrollTop = this.list.scrollHeight; this.updateCounts(); },

    updateCounts() {
      const c = {}; this.entries.forEach((e) => { c[e.level] = (c[e.level] || 0) + 1; });
      this.countEls && LEVELS.forEach(([id]) => { this.countEls[id].textContent = c[id] || 0; });
    },

    async diagnostics() {
      try { const d = await window.api.dev.diagnostics(); const txt = JSON.stringify({ ...d, renderer: { documents: MW.documents.size, tabs: MW.tabs.order.length, history: MW.editor.doc ? MW.editor.doc.history.states.length : 0 } }, null, 2); this.entries.push({ id: 0, ts: Date.now(), level: 'info', source: 'dev', message: 'Diagnostic :\n' + txt }); this.renderAll(); return txt; }
      catch (e) { MW.notify.error(e.message); return ''; }
    },

    build() {
      MW.clear(this.el);
      this.countEls = {};
      const seg = LEVELS.map(([id, label]) => { const cnt = h('span', { class: 'cnt' }, '0'); this.countEls[id] = cnt; return h('button', { class: 'lv-btn lv-' + id, 'aria-pressed': String(this.filters.has(id)), onClick: (ev) => { this.filters.has(id) ? this.filters.delete(id) : this.filters.add(id); ev.currentTarget.setAttribute('aria-pressed', String(this.filters.has(id))); this.renderAll(); } }, label, cnt); });
      const tool = (label, fn, tip) => h('button', { class: 'btn small', 'data-tip': tip, onClick: fn }, label);
      const testLogs = () => ['debug', 'info', 'success', 'warn', 'error'].forEach((lv) => window.api.app.log(lv, 'Log de test (' + lv + ')'));
      const pause = h('button', { class: 'btn small', 'aria-pressed': 'false', onClick: (ev) => { this.paused = !this.paused; ev.currentTarget.textContent = this.paused ? '▶ Reprendre' : '⏸ Pause'; if (!this.paused) { const b = this.buffer; this.buffer = []; b.forEach((e) => this.push(e)); } } }, '⏸ Pause');
      this.list = h('div', { class: 'log-list', role: 'log', 'aria-live': 'off', tabindex: '0', 'aria-label': 'Flux de logs' });
      this.el.append(
        h('div', { class: 'dev-head' }, h('span', { class: 'dev-title' }, icon('command', 15), 'Console développeur'), h('div', { class: 'seg' }, seg), h('span', { class: 'sb-spacer' }),
          tool('Logs de test', testLogs, 'Émet un log de chaque niveau'),
          tool('Diagnostic', () => this.diagnostics(), 'État de l’application'),
          tool('Copier', async () => { const t = this.entries.filter((e) => this.filters.has(e.level)).map((e) => this.fmtTime(e.ts) + ' ' + e.level.toUpperCase() + ' [' + e.source + '] ' + e.message).join('\n'); await navigator.clipboard.writeText(t); MW.notify.success('Logs copiés'); }, 'Copier les logs filtrés'),
          tool('Simuler une erreur', () => { setTimeout(() => { throw new Error('Erreur de test (renderer)'); }, 0); }, 'Lève une erreur non gérée'),
          tool('Reconnecter Discord', () => MW.commands.execute('discord.reconnect'), 'Relance la connexion RPC'),
          pause, tool('Effacer', () => { this.entries = []; this.renderAll(); }),
          h('button', { class: 'icon-btn', 'aria-label': 'Fermer la console', onClick: () => this.close() }, icon('x', 16))),
        this.list);
      this.renderAll();
    },
  };
  MW.devConsole = C;
})();
