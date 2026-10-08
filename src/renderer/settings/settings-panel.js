(function () {
  const MW = window.MW; const { h, icon } = MW;

  const CATS = [
    ['general', 'Général'], ['editor', 'Éditeur'], ['appearance', 'Apparence'], ['shortcuts', 'Raccourcis'],
    ['files', 'Fichiers'], ['autosave', 'Auto-save'], ['discord', 'Discord'], ['wiki', 'Wiki & Aide'], ['advanced', 'Avancé'], ['dev', 'Développeur'], ['about', 'À propos'],
  ];
  const visibleCats = () => CATS.filter(([id]) => id !== 'dev' || MW.devConsole.available());
  const S = () => MW.Store.settings;
  const save = (patch) => MW.Store.set(patch).catch((e) => MW.notify.error(e.message));

  // ── Contrôles ──
  function toggle(key, sub) {
    const get = () => (sub ? S()[key][sub] : S()[key]);
    const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!get()), onClick: () => {
      const v = !get(); b.setAttribute('aria-checked', String(v)); save(sub ? { [key]: { [sub]: v } } : { [key]: v });
    } });
    return b;
  }
  function select(key, options, { sub, num } = {}) {
    const cur = sub ? S()[key][sub] : S()[key];
    const el = h('select', { class: 'field', onChange: () => {
      let v = el.value; if (num) v = Number(v);
      save(sub ? { [key]: { [sub]: v } } : { [key]: v });
    } }, options.map((o) => h('option', { value: String(o.value), selected: String(o.value) === String(cur) ? true : null }, o.label)));
    return el;
  }
  function range(key, min, max, step, fmt) {
    const val = h('span', { class: 'range-val' }, fmt(S()[key]));
    const el = h('input', { type: 'range', min, max, step, value: S()[key], 'aria-label': key, onInput: () => { val.textContent = fmt(Number(el.value)); }, onChange: () => save({ [key]: Number(el.value) }) });
    return h('span', { class: 'ctl' }, el, val);
  }
  function color(key) {
    const el = h('input', { type: 'color', value: S()[key], 'aria-label': 'Couleur d’accent', onChange: () => save({ [key]: el.value }) });
    const reset = h('button', { class: 'btn small ghost', onClick: () => { el.value = '#6b7cff'; save({ [key]: '#6b7cff' }); } }, 'Par défaut');
    return h('span', { class: 'ctl' }, el, reset);
  }
  const row = (label, desc, ctl) => h('div', { class: 'set-row' }, h('div', null, h('div', { class: 'lbl' }, label), desc ? h('div', { class: 'desc' }, desc) : null), h('div', { class: 'ctl' }, ctl));
  const note = (...c) => h('div', { class: 'set-note' }, ...c);

  // ── Pages ──
  const pages = {
    general: () => [
      row('Rouvrir les documents précédents', 'Restaure les onglets ouverts à la fermeture de l’application.', toggle('restoreSession')),
      row('Barre de statut', 'Position du curseur, compteurs, encodage, état de sauvegarde.', toggle('statusBarVisible')),
      row('Taille de la liste des récents', 'Nombre maximum de fichiers récents conservés.', select('recentLimit', [5, 10, 15, 20, 30, 50].map((n) => ({ value: n, label: String(n) })), { num: true })),
      row('Langue', 'L’interface est disponible en français.', h('span', { class: 'dim' }, 'Français')),
    ],
    editor: () => [
      row('Police', null, select('font', MW.FONT_CHOICES)),
      row('Taille de police', null, range('fontSize', 10, 32, 1, (v) => v + ' px')),
      row('Interligne', null, range('lineHeight', 1.2, 2.4, 0.1, (v) => v.toFixed(1))),
      row('Zoom', 'Ctrl + / Ctrl − / Ctrl 0, ou Ctrl + molette.', select('zoom', MW.ZOOM_LEVELS.map((z) => ({ value: z, label: z + ' %' })), { num: true })),
      row('Retour à la ligne automatique', null, toggle('wordWrap')),
      row('Numéros de ligne', 'Colonne de numéros à gauche (suit le retour à la ligne). Alt+L.', toggle('showLineNumbers')),
      row('Thème de l’aperçu Markdown', 'Utilisé par /md, le Wiki et le créateur de README.', select('mdPreviewTheme', [{ value: 'neon', label: 'Néon' }, { value: 'glass', label: 'Verre (glassmorphism)' }, { value: 'paper', label: 'Papier' }])),
      row('Afficher les caractères invisibles', 'Espaces (·), tabulations (→) et fins de ligne (¶). Limité aux documents de moins de 200 000 caractères.', toggle('showInvisibles')),
      row('Largeur de tabulation', null, select('tabSize', [2, 3, 4, 8].map((n) => ({ value: n, label: n + ' espaces' })), { num: true })),
      row('Insérer des espaces avec Tab', 'Désactivé : insère un vrai caractère de tabulation.', toggle('insertSpaces')),
    ],
    appearance: () => [
      row('Thème', 'Le changement est immédiat.', select('theme', [{ value: 'dark', label: 'Sombre' }, { value: 'light', label: 'Clair' }, { value: 'system', label: 'Système' }])),
      row('Couleur d’accent', null, color('accentColor')),
      row('Densité', 'Hauteur des onglets et des éléments de la barre latérale.', select('density', [{ value: 'compact', label: 'Compacte' }, { value: 'normal', label: 'Normale' }, { value: 'comfortable', label: 'Confortable' }])),
      row('Arrondis', null, range('radius', 0, 16, 1, (v) => v + ' px')),
      row('Animations', 'Transitions et effets de l’interface.', toggle('animations')),
      row('Barre latérale réduite', null, toggle('sidebarCollapsed')),
    ],
    autosave: () => [
      row('Sauvegarde automatique', 'Elle se déclenche après un temps sans frappe (jamais à chaque caractère). Les nouveaux documents non enregistrés sont protégés par la récupération après crash.', select('autosaveInterval', MW.AUTOSAVE_INTERVALS, { num: true })),
      note('Un fichier modifié par une autre application n’est jamais écrasé automatiquement : un conflit doit d’abord être résolu.'),
    ],
    files: () => [
      row('Créer des versions de sauvegarde', 'Avant d’écraser un fichier, une copie est conservée dans le dossier de données de l’application.', toggle('backupEnabled')),
      row('Versions conservées par fichier', null, select('backupKeep', [1, 3, 5, 10, 20, 50].map((n) => ({ value: n, label: String(n) })), { num: true })),
      row('Supprimer les versions plus anciennes que', null, select('backupMaxAgeDays', [7, 14, 30, 90, 365].map((n) => ({ value: n, label: n + ' jours' })), { num: true })),
      row('Dossier des sauvegardes', null, h('button', { class: 'btn small', onClick: () => MW.commands.execute('files.openBackups') }, 'Ouvrir')),
    ],
    advanced: () => [
      row('Mode développeur', 'Débloque la console de logs colorée (Ctrl+Maj+L), les outils de test, l’administration du Wiki et les DevTools (Ctrl+Maj+I).', (() => { const t = toggle('developerMode'); t.addEventListener('click', () => setTimeout(() => P.render(), 400)); return t; })()),
      row('Afficher les nouveautés après une mise à jour', 'Fenêtre de notes de version au premier lancement d’une nouvelle version.', toggle('showWhatsNew')),
      row('Dossier des journaux', 'app.log et errors.log', h('button', { class: 'btn small', onClick: () => window.api.system.openFolder('logs').catch((e) => MW.notify.error(e.message)) }, 'Ouvrir')),
      row('Dossier de données', 'Paramètres, sauvegardes, récupération.', h('button', { class: 'btn small', onClick: () => window.api.system.openFolder('userData').catch((e) => MW.notify.error(e.message)) }, 'Ouvrir')),
      row('Réinitialiser les paramètres', 'Remet tous les réglages par défaut (fichiers récents et favoris conservés).', h('button', { class: 'btn small danger', onClick: async () => {
        if (await MW.dialogs.confirm('Réinitialiser les paramètres', 'Tous les réglages reviendront à leurs valeurs par défaut.', { ok: 'Réinitialiser', danger: true })) {
          await MW.Store.reset(); MW.shortcuts.invalidate(); MW.settingsPanel.render(); MW.notify.success('Paramètres réinitialisés.');
        }
      } }, 'Réinitialiser')),
    ],
    wiki: () => [
      row('Wiki', 'Documentation intégrée, synchronisée avec GitHub au démarrage (si un dépôt est configuré) et mise en cache pour un usage hors ligne.', h('button', { class: 'btn small primary', onClick: () => { P.close(); MW.wiki.open(); } }, 'Ouvrir le Wiki')),
      row('Recharger le Wiki', 'Force la récupération des pages Markdown depuis GitHub.', h('button', { class: 'btn small', onClick: () => MW.commands.execute('wiki.reload') }, '↻ Recharger')),
      row('Wiki en ligne', 'Ouvre le dossier du wiki sur GitHub.', h('button', { class: 'btn small', onClick: async () => { const i = await window.api.wiki.info(); if (i.onlineUrl) window.api.app.openExternal(i.onlineUrl).catch((e) => MW.notify.error(e.message)); else MW.notify.info('Aucun dépôt GitHub configuré (app.config.js › github).'); } }, 'Ouvrir sur GitHub')),
      row('Administration du Wiki', 'Créer, modifier, supprimer des pages (mode développeur ou mot de passe admin).', h('button', { class: 'btn small', onClick: () => { P.close(); MW.wikiAdmin.open(); } }, 'Administration')),
      row('Créateur de README', 'Générez un README professionnel (badges, installation, utilisation…).', h('button', { class: 'btn small', onClick: () => { P.close(); MW.readmeBuilder.open(); } }, 'Ouvrir')),
      row('Aperçu Markdown (/md)', 'Rendu en direct du document actif. Tapez /md dans la palette ou Ctrl+Maj+M.', h('button', { class: 'btn small', onClick: () => { P.close(); MW.commands.execute('md.preview'); } }, 'Activer')),
      row('Notes de version', 'Les nouveautés de la version installée.', h('button', { class: 'btn small', onClick: () => { P.close(); MW.whatsNew.open(); } }, 'Afficher')),
    ],
    dev: () => {
      const diag = h('pre', { class: 'set-note', style: { whiteSpace: 'pre-wrap', maxHeight: '240px', overflow: 'auto' }, hidden: true });
      return [
        row('Console de logs', 'Flux en temps réel : 🟢 succès · 🟡 avertissements · 🔴 erreurs · 🔵 infos.', h('button', { class: 'btn small primary', onClick: () => { P.close(); MW.devConsole.toggle(); } }, 'Ouvrir la console')),
        row('Logs de test', 'Émet un message de chaque niveau pour vérifier les couleurs.', h('button', { class: 'btn small', onClick: () => ['debug', 'info', 'success', 'warn', 'error'].forEach((l) => window.api.app.log(l, 'Log de test (' + l + ')')) }, 'Émettre')),
        row('Diagnostic', 'Versions, mémoire, état Discord / mises à jour / wiki.', h('button', { class: 'btn small', onClick: async () => { diag.textContent = JSON.stringify(await window.api.dev.diagnostics(), null, 2); diag.hidden = false; } }, 'Afficher')),
        row('DevTools Chromium', null, h('button', { class: 'btn small', onClick: () => MW.commands.execute('dev.devtools') }, 'Ouvrir')),
        diag,
      ];
    },
    about: () => {
      const i = MW.Store.info;
      const result = h('div', { class: 'dim', 'aria-live': 'polite' });
      return [h('div', { style: { textAlign: 'center', padding: '24px 0 8px' } },
        h('img', { src: '../../assets/logo/logo.svg', width: 84, height: 84, alt: '', style: { borderRadius: '20px' } }),
        h('h2', { style: { margin: '14px 0 2px', fontSize: '22px' } }, i.name),
        h('div', { class: 'dim' }, 'Version ' + i.version),
        h('p', { style: { maxWidth: '44ch', margin: '12px auto' } }, i.description),
        h('p', { class: 'dim' }, 'Node.js ' + i.node + ' · Electron ' + i.electron + ' · Chromium ' + i.chrome.split('.')[0]),
        h('p', { class: 'dim' }, i.copyright),
        h('div', { class: 'dim' }, i.githubRepo ? 'Dépôt : ' + i.githubRepo : 'Dépôt GitHub non configuré'),
        h('button', { class: 'btn', onClick: async (e) => { e.target.disabled = true; result.textContent = 'Vérification…'; try { result.textContent = (await window.api.app.checkUpdates()).message; } catch (err) { result.textContent = err.message; } e.target.disabled = false; } }, 'Vérifier les mises à jour'),
        h('div', { style: { marginTop: '10px' } }, result))];
    },
  };

  // ── Raccourcis ──
  function shortcutsPage() {
    const sm = MW.shortcuts;
    const cmds = MW.commands.all().filter((c) => c.palette !== false || c.shortcut).sort((a, b) => a.category.localeCompare(b.category, 'fr') || a.title.localeCompare(b.title, 'fr'));
    const rows = cmds.map((c) => {
      const btn = h('button', { class: 'sc-btn' });
      const warn = h('span', { class: 'sc-warn' });
      const refresh = () => { const a = sm.getBinding(c.id); btn.textContent = a ? MW.ShortcutManager.format(a, MW.isMac) : 'Non défini'; btn.classList.remove('capturing'); };
      refresh();
      btn.addEventListener('click', () => {
        btn.textContent = 'Appuyez sur une combinaison…'; btn.classList.add('capturing'); warn.textContent = ''; sm.suspended = true;
        const done = () => { sm.suspended = false; document.removeEventListener('keydown', onKey, true); btn.removeEventListener('blur', onBlur); refresh(); };
        const onBlur = () => done();
        const onKey = async (e) => {
          e.preventDefault(); e.stopPropagation();
          if (e.key === 'Escape') { done(); return; }
          const accel = MW.ShortcutManager.normalizeEvent(e, MW.isMac);
          if (!accel) return;
          if (!/^(Ctrl|Alt|Meta)\+/.test(accel) && !/^F\d+$/.test(accel)) { warn.textContent = 'Ajoutez Ctrl ou Alt (ou utilisez une touche F).'; return; }
          const conflict = sm.findConflict(accel, c.id);
          if (conflict) { warn.textContent = 'Déjà utilisé par « ' + conflict.title + ' »' + (conflict.reserved ? ' (système)' : '') + '.'; return; }
          await save({ shortcuts: { ...S().shortcuts, [c.id]: accel } }); sm.invalidate(); warn.textContent = ''; done();
        };
        document.addEventListener('keydown', onKey, true); btn.addEventListener('blur', onBlur);
      });
      const clear = h('button', { class: 'btn small ghost', 'aria-label': 'Supprimer le raccourci de ' + c.title, onClick: async () => { await save({ shortcuts: { ...S().shortcuts, [c.id]: '' } }); sm.invalidate(); refresh(); } }, 'Retirer');
      const reset = h('button', { class: 'btn small ghost', 'aria-label': 'Rétablir le raccourci par défaut de ' + c.title, onClick: async () => { const s = { ...S().shortcuts }; delete s[c.id]; const conflict = sm.findConflict(sm.getDefault(c.id), c.id); await save({ shortcuts: s }); sm.invalidate(); warn.textContent = conflict ? 'Conflit avec « ' + conflict.title + ' ».' : ''; refresh(); } }, 'Défaut');
      return h('div', { class: 'sc-row' }, h('div', { class: 'ttl' }, h('div', null, c.title), h('div', { class: 'cat' }, c.category)), warn, btn, clear, reset);
    });
    return [note('Cliquez sur un raccourci puis appuyez sur la nouvelle combinaison. Les conflits sont détectés. Ctrl+A/C/X/V sont gérés par le système.'), ...rows];
  }

  // ── Discord ──
  function discordPage() {
    const d = () => S().discordRPC;
    const level = () => (d().showPath ? (d().showFullPath ? 4 : 3) : d().showFolder ? 2 : 1);
    const pill = h('span', { class: 'status-pill' });
    const msg = h('div', { class: 'desc' });
    const card = h('div', { class: 'rpc-card' });
    const setStatus = (st) => { pill.className = 'status-pill ' + st.state; pill.textContent = { connected: 'Connecté à Discord', connecting: 'Connexion…', disabled: 'Désactivé', error: 'Non connecté', 'not-configured': 'Client ID manquant' }[st.state] || st.state; msg.textContent = st.message || ''; };
    const loadPreview = async () => {
      try {
        const a = await window.api.discord.preview();
        MW.clear(card);
        card.append(h('img', { src: '../../assets/logo/logo.svg', alt: '' }), h('div', null, h('div', { class: 'l1' }, MW.Store.info.name), h('div', { class: 'l2' }, a.details || ''), h('div', { class: 'l3' }, a.state || '')));
      } catch { /* ignore */ }
    };
    window.api.discord.status().then(setStatus); loadPreview();
    MW.settingsPanel._discordUnsub && MW.settingsPanel._discordUnsub();
    MW.settingsPanel._discordUnsub = window.api.discord.onStatus(setStatus);
    const levelSel = h('select', { class: 'field', onChange: async () => {
      const v = Number(levelSel.value);
      await save({ discordRPC: { showFolder: v >= 2, showPath: v >= 3, showFullPath: v >= 4 } }); loadPreview(); MW.rpcBridge.refresh(true);
    } }, [[1, 'Niveau 1 — fichier uniquement'], [2, 'Niveau 2 — fichier + dossier'], [3, 'Niveau 3 — fichier + chemin'], [4, 'Niveau 4 — chemin complet']].map(([v, l]) => h('option', { value: v, selected: v === level() ? true : null }, l)));
    const t = (label, desc, sub) => { const sw = toggle('discordRPC', sub); sw.addEventListener('click', () => setTimeout(() => { loadPreview(); MW.rpcBridge.refresh(true); }, 350)); return row(label, desc, sw); };
    return [
      h('div', { class: 'set-row' }, h('div', null, h('div', { class: 'lbl' }, 'État de la connexion'), msg), h('div', { class: 'ctl' }, pill,
        h('button', { class: 'btn small', onClick: async () => { setStatus(await window.api.discord.reconnect()); } }, 'Reconnecter'))),
      t('Activer Discord Rich Presence', 'Affiche votre activité sur votre profil Discord. Désactivé = rien n’est envoyé.', 'enabled'),
      row('Niveau de confidentialité', 'Par défaut : nom du fichier et nom du dossier seulement. Le contenu du document n’est jamais envoyé.', levelSel),
      h('div', { class: 'set-row' }, h('div', null, h('div', { class: 'lbl' }, 'Votre Client ID Discord'), h('div', { class: 'desc' }, 'Créez une application sur discord.com/developers/applications puis collez son « Application ID » (chiffres uniquement). Le nom de l’application s’affichera sur votre profil.')),
        h('div', { class: 'ctl' }, (() => { const i = h('input', { class: 'field-input', style: { width: '210px' }, value: S().discordClientId, placeholder: '123456789012345678', inputmode: 'numeric', 'aria-label': 'Client ID Discord' }); i.addEventListener('change', async () => { const v = i.value.trim(); if (!/^\d{0,25}$/.test(v)) { MW.notify.error('Le Client ID ne contient que des chiffres.'); i.value = S().discordClientId; return; } await save({ discordClientId: v }); setTimeout(() => window.api.discord.status().then(setStatus), 800); }); return i; })(),
          h('button', { class: 'btn small', onClick: () => window.api.app.openExternal('https://discord.com/developers/applications').catch((e) => MW.notify.error(e.message)) }, 'Ouvrir le portail'))),
      t('Afficher le nom du fichier', null, 'showFileName'),
      t('Icône du type de fichier', 'Petite icône selon l’extension (nécessite les images dans « Rich Presence › Art Assets » — voir discord-rpc.js › fileTypeIcons).', 'showIcon'),
      t('Afficher le nombre d’onglets', 'Ajoute « · 3 onglets » à la ligne du fichier.', 'showTabs'),
      t('Afficher l’extension', null, 'showExtension'),
      t('Afficher le statut d’édition', 'Lecture, Édition, Sauvegarde, Recherche.', 'showStatus'),
      t('Afficher le temps', 'Durée écoulée sur Discord.', 'showTime'),
      t('Réinitialiser le temps à chaque changement de document', null, 'resetTimerOnChange'),
      h('div', { class: 'desc', style: { marginTop: '14px' } }, 'Aperçu de ce qui est envoyé :'), card,
      note('Textes, images, icônes par type, boutons : tout se modifie dans ', h('code', null, 'src/main/discord/discord-rpc.js'), ' (bloc CONFIG). Sans recompiler, vous pouvez aussi créer ', h('code', null, 'discord-rpc.override.json'), ' dans le dossier de données (Avancé), puis cliquer sur « Reconnecter ».'),
    ];
  }

  const P = {
    el: null, cat: 'general', dlg: null, content: null, title: null,
    open(cat) {
      if (this.dlg) { this.cat = cat || this.cat; this.render(); return; }
      this.cat = cat || 'general';
      const nav = h('nav', { class: 'settings-nav', 'aria-label': 'Catégories de paramètres' }, h('h2', null, 'PARAMÈTRES'));
      this.nav = nav;
      this.title = h('h1', null);
      this.content = h('div', { class: 'settings-body' });
      const main = h('div', { class: 'settings-main' }, h('div', { class: 'settings-top' }, this.title, h('button', { class: 'icon-btn', 'aria-label': 'Fermer les paramètres', onClick: () => this.close() }, icon('x', 18))), this.content);
      this.dlg = MW.dialogs.show({ body: h('div', { style: { display: 'contents' } }, nav, main), raw: true, className: 'settings', dismissValue: null, noEnter: true, onClose: () => { this.dlg = null; this._discordUnsub && this._discordUnsub(); this._discordUnsub = null; } });
      this.render();
    },
    close() { if (this.dlg) this.dlg.close(null); },
    render() {
      if (!this.dlg) return;
      MW.clear(this.nav); this.nav.append(h('h2', null, 'PARAMÈTRES'));
      if (this.cat === 'dev' && !MW.devConsole.available()) this.cat = 'advanced';
      for (const [id, label] of visibleCats()) this.nav.append(h('button', { 'aria-current': String(id === this.cat), onClick: () => { this.cat = id; this.render(); } }, label));
      this.title.textContent = CATS.find((c) => c[0] === this.cat)[1];
      MW.clear(this.content);
      const build = this.cat === 'shortcuts' ? shortcutsPage : this.cat === 'discord' ? discordPage : pages[this.cat];
      this.content.append(...build());
      this.content.scrollTop = 0;
    },
  };
  MW.settingsPanel = P;
})();
