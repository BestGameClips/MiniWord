(function () {
  const MW = window.MW; const { h } = MW;
  const ICON = { 'nouveautés': '✨', 'améliorations': '⚡', 'corrections': '🐞', 'changements': '📝' };

  const WN = {
    async entryFor(version) {
      const text = await window.api.app.getChangelog();
      const entries = MW.parseChangelog(text);
      return { entry: MW.changelogEntryFor(entries, version) || entries[0] || null, entries };
    },

    show(entry) {
      const sections = entry.sections.map((s) => h('section', { class: 'wn-sec' }, h('h3', null, (ICON[s.title.toLowerCase()] || '•') + ' ' + s.title), h('ul', null, s.items.map((i) => h('li', { html: null }, ...this.inlineParts(i))))));
      const body = h('div', { class: 'wn' }, h('div', { class: 'wn-hero' }, h('img', { src: '../../assets/logo/logo.svg', alt: '', width: 56, height: 56 }), h('div', null, h('div', { class: 'wn-kicker' }, 'MISE À JOUR'), h('div', { class: 'wn-ver' }, MW.Store.info.name + ' ' + entry.version), entry.date ? h('div', { class: 'wn-date' }, entry.date) : null)), h('div', { class: 'wn-body' }, sections));
      return MW.dialogs.show({ body, raw: true, className: 'wn-modal', dismissValue: true, buttons: [{ label: 'C’est parti !', value: true, variant: 'primary', default: true }] }).promise;
    },

    /** Texte simple avec `code` mis en valeur (pas d'HTML injecté). */
    inlineParts(text) { return String(text).split(/(`[^`]+`)/).map((p) => (p.startsWith('`') ? h('code', null, p.slice(1, -1)) : p)); },

    /** Au premier lancement après une mise à jour. */
    async maybeShow() {
      const s = MW.Store.settings, v = MW.Store.info.version;
      if (s.lastSeenVersion === v) return;
      const first = !s.lastSeenVersion;
      await MW.Store.set({ lastSeenVersion: v });
      if (first || !s.showWhatsNew) return;
      const { entry } = await this.entryFor(v);
      if (entry) await this.show(entry);
    },

    async open() {
      const { entry } = await this.entryFor(MW.Store.info.version);
      if (entry) this.show(entry); else MW.notify.info('Aucune note de version disponible.');
    },
  };
  MW.whatsNew = WN;
})();
