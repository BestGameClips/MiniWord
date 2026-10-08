(function () {
  const MW = window.MW;
  const S = () => MW.Store.settings;
  const doc = () => MW.editor.doc;
  const hasDoc = () => !!MW.editor.doc;

  function zoomBy(d) {
    const L = MW.ZOOM_LEVELS; const i = Math.max(0, Math.min(L.length - 1, L.indexOf(S().zoom) + d));
    return MW.Store.set({ zoom: L[i] });
  }
  async function setTheme(theme) { await MW.Store.set({ theme }); }

  // ── Formatage (jamais appliqué silencieusement à un fichier texte brut) ──
  function formattable(kind) {
    const d = doc(); if (!d) return false;
    const f = MW.typeForExtension(d.extension).formatting;
    return !!(f && MW.FORMATTERS[f][kind]);
  }
  async function format(kind) {
    const d = doc(); if (!d) return;
    const type = MW.typeForExtension(d.extension);
    if (!type.formatting) { MW.notify.info('Le formatage n’est pas disponible pour les fichiers ' + type.name + '. Utilisez un fichier .md ou .html.'); return; }
    if (!MW.FORMATTERS[type.formatting][kind]) { MW.notify.info('Cette mise en forme n’existe pas pour le format ' + type.name + '.'); return; }
    let extra;
    if (kind === 'link') { extra = await MW.dialogs.prompt('Insérer un lien', 'Adresse du lien (URL)', 'https://'); if (extra === null) { MW.editor.focus(); return; } }
    const sel = MW.editor.getSelection();
    const edit = MW.formatEdit(kind, type.formatting, MW.editor.getValue(), sel.start, sel.end, extra);
    if (edit) { MW.editor.applyEdit(edit); MW.editor.focus(); }
  }
  const FMT = [
    ['bold', 'Gras', 'Ctrl+B'], ['italic', 'Italique', 'Ctrl+I'], ['underline', 'Souligné', 'Ctrl+U'], ['strike', 'Barré'], ['highlight', 'Surligné'],
    ['code', 'Code en ligne'], ['codeblock', 'Bloc de code'], ['h1', 'Titre 1'], ['h2', 'Titre 2'], ['h3', 'Titre 3'], ['ul', 'Liste à puces'], ['ol', 'Liste numérotée'],
    ['quote', 'Citation'], ['link', 'Lien'], ['alignLeft', 'Aligner à gauche'], ['alignCenter', 'Centrer'], ['alignRight', 'Aligner à droite'],
  ].map(([kind, title, shortcut]) => ({ id: 'format.' + kind, title, category: 'Format', shortcut, when: () => formattable(kind), run: () => format(kind) }));

  const edit = (action) => () => { MW.editor.focus(); return window.api.system.edit(action).catch(() => {}); };

  MW.registerCommands = function (cm) {
    cm.registerAll([
      // Fichier
      { id: 'file.new', title: 'Nouveau document', category: 'Fichier', shortcut: 'Ctrl+N', run: () => MW.fileActions.newDocument() },
      { id: 'file.open', title: 'Ouvrir…', category: 'Fichier', shortcut: 'Ctrl+O', run: () => MW.fileActions.openDialog() },
      { id: 'file.save', title: 'Sauvegarder', category: 'Fichier', shortcut: 'Ctrl+S', when: hasDoc, run: () => MW.fileActions.save(doc(), { reason: 'manual' }) },
      { id: 'file.saveAs', title: 'Sauvegarder sous…', category: 'Fichier', shortcut: 'Ctrl+Shift+S', when: hasDoc, run: () => MW.fileActions.saveAs(doc()) },
      { id: 'file.saveAll', title: 'Tout sauvegarder', category: 'Fichier', shortcut: 'Ctrl+Alt+S', when: () => MW.documents.dirtyDocs().length > 0, run: () => MW.fileActions.saveAll() },
      { id: 'file.close', title: 'Fermer', category: 'Fichier', shortcut: 'Ctrl+W', when: hasDoc, run: () => MW.fileActions.closeTabs([MW.tabs.activeId]) },
      { id: 'file.reopenClosed', title: 'Réouvrir l’onglet fermé', category: 'Fichier', shortcut: 'Ctrl+Shift+T', run: () => MW.fileActions.reopenClosed() },
      { id: 'file.reload', title: 'Recharger depuis le disque', category: 'Fichier', when: () => !!(doc() && doc().path), run: () => MW.fileActions.reloadFromDisk(doc()) },
      { id: 'file.reveal', title: 'Afficher dans l’explorateur', category: 'Fichier', when: () => !!(doc() && doc().path), run: () => MW.fileActions.reveal(doc().path) },
      { id: 'file.favorite', title: 'Ajouter / retirer des favoris', category: 'Fichier', when: () => !!(doc() && doc().path), run: () => MW.fileActions.toggleFavorite(doc().path) },
      { id: 'file.clearRecent', title: 'Effacer l’historique des fichiers récents', category: 'Fichier', run: () => MW.fileActions.clearRecent() },
      { id: 'window.close', title: 'Fermer la fenêtre', category: 'Fichier', shortcut: 'Ctrl+Shift+W', run: () => window.api.window.close() },
      { id: 'files.openBackups', title: 'Ouvrir le dossier des sauvegardes', category: 'Fichier', run: () => window.api.system.openFolder('backups').catch((e) => MW.notify.error(e.message)) },

      // Onglets
      { id: 'tab.next', title: 'Onglet suivant', category: 'Onglets', shortcut: 'Ctrl+Tab', when: () => MW.tabs.order.length > 1, run: () => MW.tabs.next() },
      { id: 'tab.prev', title: 'Onglet précédent', category: 'Onglets', shortcut: 'Ctrl+Shift+Tab', when: () => MW.tabs.order.length > 1, run: () => MW.tabs.prev() },
      { id: 'tab.closeOthers', title: 'Fermer les autres onglets', category: 'Onglets', when: () => MW.tabs.order.length > 1, run: () => MW.fileActions.closeTabs(MW.tabs.idsOthers(MW.tabs.activeId)) },
      { id: 'tab.closeRight', title: 'Fermer les onglets à droite', category: 'Onglets', when: hasDoc, run: () => MW.fileActions.closeTabs(MW.tabs.idsRight(MW.tabs.activeId)) },
      { id: 'tab.closeAll', title: 'Fermer tous les onglets', category: 'Onglets', when: hasDoc, run: () => MW.fileActions.closeTabs(MW.tabs.idsAll()) },
      { id: 'tab.pin', title: 'Épingler / désépingler l’onglet', category: 'Onglets', when: hasDoc, run: () => MW.tabs.togglePin(MW.tabs.activeId) },
      { id: 'tab.duplicate', title: 'Dupliquer l’onglet', category: 'Onglets', when: hasDoc, run: () => MW.fileActions.duplicate(MW.tabs.activeId) },

      // Édition
      { id: 'edit.undo', title: 'Annuler', category: 'Édition', shortcut: 'Ctrl+Z', when: hasDoc, run: () => MW.editor.undo() },
      { id: 'edit.redo', title: 'Rétablir', category: 'Édition', shortcut: 'Ctrl+Y', when: hasDoc, run: () => MW.editor.redo() },
      { id: 'edit.redoAlt', title: 'Rétablir (alternative)', category: 'Édition', shortcut: 'Ctrl+Shift+Z', palette: false, run: () => MW.editor.redo() },
      { id: 'edit.cut', title: 'Couper', category: 'Édition', when: hasDoc, run: edit('cut') },
      { id: 'edit.copy', title: 'Copier', category: 'Édition', when: hasDoc, run: edit('copy') },
      { id: 'edit.paste', title: 'Coller', category: 'Édition', when: hasDoc, run: edit('paste') },
      { id: 'edit.pastePlain', title: 'Coller sans mise en forme', category: 'Édition', shortcut: 'Ctrl+Shift+V', when: hasDoc, run: edit('pasteAndMatchStyle') },
      { id: 'edit.selectAll', title: 'Tout sélectionner', category: 'Édition', when: hasDoc, run: edit('selectAll') },

      // Recherche
      { id: 'find.open', title: 'Rechercher', category: 'Recherche', shortcut: 'Ctrl+F', when: hasDoc, run: () => MW.findBar.show('find') },
      { id: 'find.replace', title: 'Remplacer', category: 'Recherche', shortcut: 'Ctrl+H', when: hasDoc, run: () => MW.findBar.show('replace') },
      { id: 'find.next', title: 'Résultat suivant', category: 'Recherche', shortcut: 'F3', when: hasDoc, run: () => MW.findBar.step(1) },
      { id: 'find.prev', title: 'Résultat précédent', category: 'Recherche', shortcut: 'Shift+F3', when: hasDoc, run: () => MW.findBar.step(-1) },

      ...FMT,

      // Affichage
      { id: 'view.zoomIn', title: 'Zoom avant', category: 'Affichage', shortcut: 'Ctrl+Plus', run: () => zoomBy(1) },
      { id: 'view.zoomOut', title: 'Zoom arrière', category: 'Affichage', shortcut: 'Ctrl+Minus', run: () => zoomBy(-1) },
      { id: 'view.zoomReset', title: 'Zoom 100 %', category: 'Affichage', shortcut: 'Ctrl+0', run: () => MW.Store.set({ zoom: 100 }) },
      { id: 'view.palette', title: 'Palette de commandes', category: 'Affichage', shortcut: 'Ctrl+Shift+P', palette: false, run: () => MW.palette.open() },
      { id: 'view.shortcuts', title: 'Raccourcis clavier', category: 'Affichage', shortcut: 'Ctrl+/', run: () => MW.settingsPanel.open('shortcuts') },
      { id: 'view.fullscreen', title: 'Plein écran', category: 'Affichage', shortcut: 'F11', run: () => window.api.window.toggleFullscreen() },
      { id: 'view.sidebar', title: 'Afficher / réduire la barre latérale', category: 'Affichage', shortcut: 'Ctrl+Shift+B', run: () => MW.sidebar.toggle() },
      { id: 'view.statusbar', title: 'Afficher / masquer la barre de statut', category: 'Affichage', run: () => MW.Store.set({ statusBarVisible: !S().statusBarVisible }) },
      { id: 'view.wordWrap', title: 'Retour à la ligne automatique', category: 'Affichage', shortcut: 'Alt+Z', run: () => MW.Store.set({ wordWrap: !S().wordWrap }) },
      { id: 'view.invisibles', title: 'Afficher / masquer les caractères invisibles', category: 'Affichage', run: () => MW.Store.set({ showInvisibles: !S().showInvisibles }) },
      { id: 'focus.sidebar', title: 'Aller à la barre latérale', category: 'Affichage', shortcut: 'Ctrl+Shift+E', run: () => MW.sidebar.focusFirst() },
      { id: 'focus.editor', title: 'Aller à l’éditeur', category: 'Affichage', shortcut: 'Ctrl+Shift+Y', when: hasDoc, run: () => MW.editor.focus() },
      { id: 'ui.escape', title: 'Échap', category: 'Affichage', shortcut: 'Escape', palette: false, run: () => {
        if (MW.findBar.open) MW.findBar.hide(); else if (document.documentElement.dataset.fullscreen === 'true') window.api.window.toggleFullscreen();
      } },

      // Thème
      { id: 'theme.dark', title: 'Thème sombre', category: 'Thème', run: () => setTheme('dark') },
      { id: 'theme.light', title: 'Thème clair', category: 'Thème', run: () => setTheme('light') },
      { id: 'theme.system', title: 'Thème système', category: 'Thème', run: () => setTheme('system') },

      // Application
      { id: 'settings.open', title: 'Paramètres', category: 'Application', shortcut: 'Ctrl+,', run: () => MW.settingsPanel.open() },
      { id: 'app.about', title: 'À propos', category: 'Application', run: () => MW.settingsPanel.open('about') },
      { id: 'discord.toggle', title: 'Discord RPC : activer / désactiver', category: 'Discord', run: async () => { const on = !S().discordRPC.enabled; await MW.Store.set({ discordRPC: { enabled: on } }); MW.rpcBridge.refresh(true); MW.notify.info('Discord Rich Presence ' + (on ? 'activé' : 'désactivé')); } },
      { id: 'discord.settings', title: 'Discord RPC : paramètres', category: 'Discord', run: () => MW.settingsPanel.open('discord') },
      { id: 'discord.reconnect', title: 'Discord RPC : reconnecter', category: 'Discord', run: async () => { const s = await window.api.discord.reconnect(); MW.notify.info(s.state === 'connected' ? 'Connecté à Discord' : (s.message || 'Discord non connecté')); } },
      // Markdown / Wiki / README / Dev
      { id: 'md.preview', title: 'Aperçu Markdown (/md)', category: 'Markdown', shortcut: 'Ctrl+Shift+M', aliases: ['/md', '/preview'], run: () => MW.mdPreview.toggle() },
      { id: 'md.themeNeon', title: 'Aperçu : thème Néon', category: 'Markdown', aliases: ['/md neon'], run: () => MW.Store.set({ mdPreviewTheme: 'neon' }) },
      { id: 'md.themeGlass', title: 'Aperçu : thème Verre (glassmorphism)', category: 'Markdown', aliases: ['/md glass'], run: () => MW.Store.set({ mdPreviewTheme: 'glass' }) },
      { id: 'md.themePaper', title: 'Aperçu : thème Papier', category: 'Markdown', aliases: ['/md paper'], run: () => MW.Store.set({ mdPreviewTheme: 'paper' }) },
      { id: 'readme.builder', title: 'Créateur de README', category: 'Markdown', aliases: ['/readme'], run: () => MW.readmeBuilder.open() },
      { id: 'wiki.open', title: 'Ouvrir le Wiki', category: 'Aide', shortcut: 'F1', aliases: ['/wiki', '/aide'], run: () => MW.wiki.open() },
      { id: 'wiki.reload', title: 'Wiki : recharger les pages', category: 'Aide', run: async () => { const r = await window.api.wiki.refresh(); (r.ok ? MW.notify.success : MW.notify.warn)(r.message); } },
      { id: 'wiki.admin', title: 'Wiki : administration', category: 'Aide', aliases: ['/admin'], run: () => MW.wikiAdmin.open() },
      { id: 'app.whatsNew', title: 'Notes de version (Nouveautés)', category: 'Aide', aliases: ['/nouveautes', '/changelog'], run: () => MW.whatsNew.open() },
      { id: 'app.checkUpdates', title: 'Vérifier les mises à jour', category: 'Application', run: async () => { try { const r = await window.api.app.checkUpdates(); if (!['available'].includes(r.status)) MW.notify.info(r.message); } catch (e) { MW.notify.error(e.message); } } },
      { id: 'view.lineNumbers', title: 'Afficher / masquer les numéros de ligne', category: 'Affichage', shortcut: 'Alt+L', run: () => MW.Store.set({ showLineNumbers: !S().showLineNumbers }) },
      { id: 'dev.console', title: 'Développeur › Console de logs', category: 'Développeur', shortcut: 'Ctrl+Shift+L', aliases: ['/dev', '/logs'], when: () => MW.devConsole.available(), run: () => MW.devConsole.toggle() },
      { id: 'dev.devtools', title: 'Développeur › Ouvrir les DevTools', category: 'Développeur', shortcut: 'Ctrl+Shift+I', run: () => window.api.window.devTools().catch((e) => MW.notify.warn(e.message)) },
    ]);
  };
})();
