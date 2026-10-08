(function () {
  const MW = window.MW; const { h, icon } = MW;

  const SB = {
    root: null,
    init() {
      this.root = document.getElementById('sidebar');
      MW.Store.on('change', (patch) => { if (['recentFiles', 'favorites', 'sidebarCollapsed', 'sidebarRecentOpen', 'sidebarFavoritesOpen', 'recentLimit'].some((k) => k in patch) || patch.__refresh) this.render(); });
      this.render();
    },

    toggle() { MW.Store.set({ sidebarCollapsed: !MW.Store.settings.sidebarCollapsed }); },
    focusFirst() { const b = this.root.querySelector('button'); if (b) b.focus(); },

    _item(ico, label, onClick, { tip, primary } = {}) {
      return h('button', { class: 'sb-item' + (primary ? ' primary-action' : ''), 'data-tip': tip || label, 'data-tip-side': 'right', 'aria-label': label, onClick }, icon(ico, 19), h('span', { class: 'sb-label' }, label));
    },

    _fileRow(entry, kind) {
      const dir = MW.dirname(entry.path);
      return h('button', {
        class: 'sb-file', title: entry.path,
        onClick: () => MW.fileActions.openRecent(entry.path),
        onContextmenu: (e) => { e.preventDefault(); this.fileMenu(e.clientX, e.clientY, entry, kind); },
      }, h('span', { class: 'n' }, entry.name), h('span', { class: 'd' }, '\u200e' + dir));
    },

    fileMenu(x, y, entry, kind) {
      const fav = MW.Store.settings.favorites.some((f) => MW.samePath(f.path, entry.path));
      const items = [
        { label: 'Ouvrir', run: () => MW.fileActions.openRecent(entry.path) },
        { label: 'Afficher dans l’explorateur', run: () => MW.fileActions.reveal(entry.path) },
        { label: fav ? 'Retirer des favoris' : 'Ajouter aux favoris', run: () => MW.fileActions.toggleFavorite(entry.path) },
      ];
      if (kind === 'recent') items.push({ separator: true }, { label: 'Retirer des récents', run: () => MW.fileActions.removeRecent(entry.path) });
      MW.contextMenu.show(x, y, items);
    },

    _section(id, ico, label, entries, kind, openKey, actions) {
      const s = MW.Store.settings;
      const open = s[openKey];
      const collapsed = s.sidebarCollapsed;
      const head = h('div', { style: { display: 'flex', alignItems: 'center' } },
        h('button', { class: 'sb-item', style: { flex: 1 }, 'aria-expanded': String(open), 'data-tip': label, 'data-tip-side': 'right', 'aria-label': label,
          onClick: () => { if (collapsed) MW.Store.set({ sidebarCollapsed: false, [openKey]: true }); else MW.Store.set({ [openKey]: !open }); } },
          icon(ico, 19), h('span', { class: 'sb-label' }, label), h('span', { class: 'sb-chevron' }, icon('chevronRight', 14))),
        !collapsed && entries.length && actions ? h('span', { class: 'sb-section-actions' }, actions) : null);
      const list = h('div', { class: 'sb-list' }, entries.length ? entries.map((e) => this._fileRow(e, kind)) : h('div', { class: 'sb-empty' }, kind === 'recent' ? 'Aucun fichier récent' : 'Aucun favori'));
      list.hidden = !open;
      return h('div', { class: 'sb-section', dataset: { open: String(open) } }, head, list);
    },

    render() {
      const s = MW.Store.settings;
      const root = this.root;
      root.dataset.collapsed = String(!!s.sidebarCollapsed);
      MW.clear(root);
      root.append(
        h('div', { class: 'sb-head' }, h('span', { class: 'sb-title' }, MW.Store.info ? MW.Store.info.name : ''),
          h('button', { class: 'icon-btn', 'aria-label': s.sidebarCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale', 'data-tip': 'Barre latérale (Ctrl+Maj+B)', 'data-tip-side': s.sidebarCollapsed ? 'right' : null, onClick: () => this.toggle() }, icon('menu', 18))),
        this._item('file-plus', 'Nouveau', () => MW.commands.execute('file.new'), { tip: 'Nouveau (Ctrl+N)', primary: true }),
        this._item('folder', 'Ouvrir', () => MW.commands.execute('file.open'), { tip: 'Ouvrir (Ctrl+O)', primary: true }),
        h('div', { class: 'sb-sep' }),
        this._section('recent', 'clock', 'Récents', s.recentFiles, 'recent', 'sidebarRecentOpen',
          h('button', { class: 'icon-btn', 'aria-label': 'Effacer l’historique', 'data-tip': 'Effacer l’historique', onClick: () => MW.fileActions.clearRecent() }, icon('trash', 15))),
        this._section('fav', 'star', 'Favoris', s.favorites, 'favorite', 'sidebarFavoritesOpen'),
        h('div', { class: 'sb-grow' }),
        h('div', { class: 'sb-sep' }),
        this._item('gear', 'Paramètres', () => MW.settingsPanel.open(), { tip: 'Paramètres (Ctrl+,)' }),
        this._item('info', 'À propos', () => MW.settingsPanel.open('about')));
    },
  };
  MW.sidebar = SB;
})();
