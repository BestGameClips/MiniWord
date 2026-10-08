(function () {
  const MW = window.MW; const { h, icon } = MW;
  const $ = (id) => document.getElementById(id);
  const recoveryTimers = new Map();

  const App = {
    // ───────────── Rafraîchissements ─────────────
    statusChanged: MW.debounce(() => { MW.statusbar.update(); }, 60),

    updateTitle() {
      const d = MW.editor.doc, name = MW.Store.info.name;
      const t = d ? (d.isDirty ? '● ' : '') + d.name : name;
      $('tb-title').textContent = d ? t + ' — ' + name : '';
      document.title = d ? t + ' — ' + name : name;
      window.api.window.setTitle(document.title);
    },

    renderEmpty() {
      const el = $('empty-state'), empty = MW.documents.size === 0;
      el.hidden = !empty;
      if (!empty) return;
      MW.clear(el);
      const recents = MW.Store.settings.recentFiles.slice(0, 5);
      el.append(
        h('img', { src: '../../assets/logo/logo.svg', alt: '' }),
        h('h1', null, MW.Store.info.name),
        h('p', null, MW.Store.info.description),
        h('div', { class: 'empty-actions' },
          h('button', { class: 'btn primary', onClick: () => MW.commands.execute('file.new') }, icon('file-plus', 16), 'Nouveau document ', h('kbd', null, 'Ctrl+N')),
          h('button', { class: 'btn', onClick: () => MW.commands.execute('file.open') }, icon('folder', 16), 'Ouvrir ', h('kbd', null, 'Ctrl+O'))),
        recents.length ? h('div', { class: 'empty-recents' }, h('h2', null, 'Récents'),
          recents.map((r) => h('button', { class: 'sb-file', style: { paddingLeft: '10px' }, title: r.path, onClick: () => MW.fileActions.openRecent(r.path) }, h('span', { class: 'n' }, r.name), h('span', { class: 'd' }, '\u200e' + MW.dirname(r.path))))) : null,
        h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Glissez-déposez des fichiers ici · ', h('kbd', null, 'Ctrl+Maj+P'), ' pour toutes les commandes'));
    },

    /** Rafraîchit tout ce qui dépend du document actif. */
    refreshAll() {
      MW.banner.render();
      MW.statusbar.update();
      this.updateTitle();
      this.renderEmpty();
      MW.tabbar.render();
      MW.rpcBridge.refresh();
      if (MW.findBar.open) MW.findBar.refresh();
    },

    onTabChange(evt) {
      const doc = MW.documents.get(MW.tabs.activeId);
      if (!MW.editor.doc || !doc || MW.editor.doc.id !== doc.id || evt.type === 'remove') MW.editor.setDocument(doc);
      this.refreshAll();
      if (evt.type !== 'move') this.saveSessionSoon();
      if (evt.type === 'activate' || evt.type === 'add') MW.editor.focus();
    },

    // ───────────── Récupération après crash ─────────────
    scheduleRecovery(doc) {
      clearTimeout(recoveryTimers.get(doc.id));
      recoveryTimers.set(doc.id, setTimeout(() => {
        recoveryTimers.delete(doc.id);
        if (!MW.documents.get(doc.id)) return;
        if (doc.isDirty) window.api.recovery.save({ id: doc.id, name: doc.name, path: doc.path, content: doc.content, encoding: doc.encoding, eol: doc.eol }).catch(() => {});
        else window.api.recovery.clear(doc.id).catch(() => {});
      }, 1500));
    },
    clearRecovery(id) { clearTimeout(recoveryTimers.get(id)); recoveryTimers.delete(id); window.api.recovery.clear(id).catch(() => {}); },

    async checkRecovery() {
      let list;
      try { list = await window.api.recovery.list(); } catch { return; }
      if (!list.length) return;
      const names = list.map((e) => '• ' + e.name).join('\n');
      const body = h('div', null, h('p', null, 'Des documents non sauvegardés ont été trouvés.'), h('p', { class: 'dim', style: { whiteSpace: 'pre-line' } }, names));
      const c = await MW.dialogs.show({ title: 'Récupération', body, dismissValue: 'ignore', buttons: [{ label: 'Ignorer', value: 'ignore' }, { label: 'Récupérer', value: 'restore', variant: 'primary', default: true }] }).promise;
      if (c !== 'restore') { await window.api.recovery.clear('*').catch(() => {}); return; }
      for (const item of list) {
        try {
          const e = await window.api.recovery.restore(item.id);
          let doc = e.path ? MW.documents.findByPath(e.path) : null;
          if (!doc && e.path) {
            const r = (await window.api.files.openPaths([e.path], { track: false }))[0];
            if (r.ok) { doc = MW.documents.createFromFile(r.file); MW.tabs.add(doc.id, { activate: false }); }
          }
          if (!doc) { doc = MW.documents.createUntitled({ content: e.content, encoding: e.encoding, eol: e.eol }); MW.documents.update(doc.id, { name: e.name || doc.name }); MW.tabs.add(doc.id, { activate: false }); }
          else { MW.documents.setContent(doc.id, e.content); doc.history.reset(e.content); if (MW.editor.doc && MW.editor.doc.id === doc.id) MW.editor.setDocument(doc); }
          this.scheduleRecovery(doc);
          await window.api.recovery.clear(item.id);
        } catch (err) { MW.notify.error('Impossible de récupérer « ' + item.name + ' ».'); }
      }
      if (!MW.tabs.activeId && MW.tabs.order.length) MW.tabs.activate(MW.tabs.order[0]);
      this.refreshAll();
      MW.notify.success('Documents récupérés');
    },

    // ───────────── Session ─────────────
    async saveSession() {
      const docs = MW.tabs.order.map((id) => MW.documents.get(id)).filter((d) => d && d.path);
      const active = MW.documents.get(MW.tabs.activeId);
      try { await window.api.settings.set({ session: { tabs: docs.map((d) => ({ path: d.path, pinned: MW.tabs.isPinned(d.id) })), active: active && active.path ? active.path : null } }); } catch { /* ignore */ }
    },
    saveSessionSoon: MW.debounce(() => App.saveSession(), 800),

    async restoreSession(extraPaths) {
      const s = MW.Store.settings;
      if (s.restoreSession && s.session.tabs.length) {
        await MW.fileActions.openPaths(s.session.tabs.map((t) => t.path), { track: false, silent: true });
        s.session.tabs.forEach((t) => { const d = MW.documents.findByPath(t.path); if (d && t.pinned) MW.tabs.setPinned(d.id, true); });
        const act = s.session.active && MW.documents.findByPath(s.session.active);
        if (act) MW.tabs.activate(act.id);
      }
      if (extraPaths.length) await MW.fileActions.openPaths(extraPaths);
    },

    // ───────────── Divers ─────────────
    toggleEol() {
      const d = MW.editor.doc; if (!d) return;
      MW.documents.update(d.id, { eol: d.eol === 'LF' ? 'CRLF' : 'LF', forceDirty: true });
      MW.autosave.notifyChange(d); this.scheduleRecovery(d); this.refreshAll();
    },
    encodingMenu(e) {
      const d = MW.editor.doc; if (!d) return;
      const r = e.currentTarget.getBoundingClientRect();
      MW.contextMenu.show(r.left, r.top - 170, MW.ENCODINGS.map((enc) => ({ label: enc.label, checked: enc.value === d.encoding, run: () => { MW.documents.update(d.id, { encoding: enc.value, forceDirty: true }); MW.autosave.notifyChange(d); this.refreshAll(); MW.notify.info('Encodage à l’enregistrement : ' + enc.label); } })));
    },

    editorMenu(e) {
      const has = MW.editor.getSelection().end > MW.editor.getSelection().start;
      const sc = (id) => MW.ShortcutManager.format(MW.shortcuts.getBinding(id), MW.isMac);
      MW.contextMenu.show(e.clientX, e.clientY, [
        { label: 'Couper', shortcut: 'Ctrl+X', disabled: !has, run: () => MW.commands.execute('edit.cut') },
        { label: 'Copier', shortcut: 'Ctrl+C', disabled: !has, run: () => MW.commands.execute('edit.copy') },
        { label: 'Coller', shortcut: 'Ctrl+V', run: () => MW.commands.execute('edit.paste') },
        { label: 'Sélectionner tout', shortcut: 'Ctrl+A', run: () => MW.commands.execute('edit.selectAll') },
        { separator: true },
        { label: 'Rechercher', shortcut: sc('find.open'), run: () => MW.commands.execute('find.open') },
        { label: 'Remplacer', shortcut: sc('find.replace'), run: () => MW.commands.execute('find.replace') },
      ]);
    },

    setupDragDrop() {
      const ov = $('drop-overlay'); let depth = 0;
      const isFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
      window.addEventListener('dragenter', (e) => { if (isFiles(e)) { depth++; ov.hidden = false; } });
      window.addEventListener('dragleave', (e) => { if (isFiles(e) && --depth <= 0) { depth = 0; ov.hidden = true; } });
      window.addEventListener('dragover', (e) => { if (isFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
      window.addEventListener('drop', (e) => {
        if (!isFiles(e)) return;
        e.preventDefault(); depth = 0; ov.hidden = true;
        const paths = [...e.dataTransfer.files].map((f) => window.api.files.getPathForFile(f)).filter(Boolean);
        if (paths.length) MW.fileActions.openPaths(paths); else MW.notify.error('Impossible de lire le fichier déposé.');
      });
    },

    setupWindowControls() {
      $('win-min').onclick = () => window.api.window.minimize();
      $('win-max').onclick = () => window.api.window.maximize();
      $('win-close').onclick = () => window.api.window.close();
      const apply = (st) => {
        document.documentElement.dataset.fullscreen = String(!!st.fullscreen);
        $('win-max').setAttribute('aria-label', st.maximized ? 'Restaurer' : 'Agrandir');
        $('win-max').dataset.tip = st.maximized ? 'Restaurer' : 'Agrandir';
        $('win-max-icon').innerHTML = st.maximized
          ? '<rect x="3.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.1" fill="none"/><path d="M1.5 4v5.5a1 1 0 0 0 1 1H8" stroke="currentColor" stroke-width="1.1" fill="none"/>'
          : '<rect x="2.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>';
      };
      window.api.window.onState(apply);
      window.api.window.getState().then(apply);
    },
  };
  MW.app = App;

  async function init() {
    window.addEventListener('error', (e) => window.api.app.log('error', e.message, e.error && e.error.stack));
    window.addEventListener('unhandledrejection', (e) => window.api.app.log('error', 'Promesse rejetée : ' + (e.reason && e.reason.message || e.reason), e.reason && e.reason.stack));

    await MW.Store.init();
    const S = () => MW.Store.settings;
    $('tb-appname').textContent = MW.Store.info.name;

    // Cœur logique
    MW.documents = new MW.DocumentManager();
    MW.tabs = new MW.TabManager();
    MW.commands = new MW.CommandManager();
    MW.registerCommands(MW.commands);
    MW.shortcuts = new MW.ShortcutManager({ commands: MW.commands, getOverrides: () => S().shortcuts, isMac: MW.isMac });
    MW.shortcuts.blocked = (e) => MW.dialogs.isOpen() || (e.target && /^(INPUT|SELECT)$/.test(e.target.tagName) && e.ctrlKey && /^[zy]$/i.test(e.key));
    MW.shortcuts.on('error', (err) => MW.notify.error(err.message || 'La commande a échoué.'));
    MW.autosave = new MW.AutosaveManager({
      getInterval: () => S().autosaveInterval,
      canAutosave: (d) => !!d.path && !d.externalState,
      save: (d, o) => MW.fileActions.save(d, o),
    });

    // Interface
    MW.editor.init({
      documents: MW.documents, getSettings: S,
      onChange: (doc) => { MW.autosave.notifyChange(doc); App.scheduleRecovery(doc); App.statusChanged(); if (MW.findBar.open) MW.findBar.refresh(); },
      onSelection: () => App.statusChanged(),
      onContextMenu: (e) => App.editorMenu(e),
      onZoom: (d) => MW.commands.execute(d > 0 ? 'view.zoomIn' : 'view.zoomOut'),
    });
    MW.findBar.init(); MW.statusbar.init(); MW.tabbar.init(); MW.sidebar.init(); MW.mdPreview.init(); MW.updates.init();
    MW.documents.on('dirty', (doc) => { if (MW.editor.doc && MW.editor.doc.id === doc.id) { App.updateTitle(); App.statusChanged(); MW.rpcBridge.refresh(); } });
    MW.documents.on('meta', () => { MW.banner.render(); App.statusChanged(); App.updateTitle(); });
    MW.tabs.on('change', (evt) => App.onTabChange(evt));
    MW.Store.on('change', (p) => {
      MW.shortcuts.invalidate();
      if (p && 'developerMode' in p && !MW.devConsole.available() && MW.devConsole.active) MW.devConsole.close();
    });
    App.setupDragDrop(); App.setupWindowControls();
    MW.Store.apply();

    // Évènements système
    document.addEventListener('keydown', (e) => MW.shortcuts.handleKeydown(e), true);
    document.addEventListener('contextmenu', (e) => { if (e.target.id !== 'editor' && !e.target.closest('input, textarea')) e.preventDefault(); });
    window.api.files.onChanged((evt) => MW.fileActions.onFileEvent(evt));
    window.api.app.onOpenPaths((paths) => MW.fileActions.openPaths(paths));
    window.api.app.onRequestClose(() => MW.fileActions.requestWindowClose());

    // Démarrage : session, fichiers passés en argument, récupération
    const initial = await window.api.app.getInitialPaths();
    App.refreshAll();
    await App.restoreSession(initial);
    await App.checkRecovery();
    App.refreshAll();
    MW.rpcBridge.refresh(true);
    MW.whatsNew.maybeShow().catch((e) => window.api.app.log('warn', 'Nouveautés : ' + e.message));
  }

  window.addEventListener('DOMContentLoaded', () => init().catch((e) => {
    console.error(e);
    document.body.append(h('pre', { style: { padding: '24px', color: '#f66', userSelect: 'text' } }, 'Erreur de démarrage : ' + (e && e.message)));
  }));
})();
