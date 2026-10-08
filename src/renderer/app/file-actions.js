(function () {
  const MW = window.MW; const { h } = MW;
  const err = (e, fallback) => (e && e.message) || fallback;

  const FA = {
    closing: false,

    // ───────────── Création / ouverture ─────────────
    newDocument() {
      const doc = MW.documents.createUntitled();
      MW.tabs.add(doc.id, { afterActive: true });
      MW.editor.focus();
      return doc;
    },

    async openDialog() {
      let results;
      try { results = await window.api.files.open(); } catch (e) { MW.notify.error(err(e, 'Impossible d’ouvrir le fichier.')); return; }
      await this.openResults(results);
    },

    async openPaths(paths, { track = true, silent = false } = {}) {
      if (!paths.length) return;
      let results;
      try { results = await window.api.files.openPaths(paths, { track }); } catch (e) { MW.notify.error(err(e, 'Impossible d’ouvrir le fichier.')); return; }
      await this.openResults(results, { silent });
    },

    async openResults(results, { silent = false } = {}) {
      let opened = 0, last = null;
      for (const r of results) {
        if (!r.ok) { if (!silent) MW.notify.error((r.path ? MW.basename(r.path) + ' : ' : '') + r.error.message); continue; }
        const f = r.file;
        const existing = MW.documents.findByPath(f.path);
        if (existing) {
          last = existing;
          if (existing.mtimeMs != null && Math.abs(existing.mtimeMs - f.mtimeMs) > 1 && !existing.externalState) { existing.externalState = 'changed'; existing.externalInfo = { mtimeMs: f.mtimeMs }; }
          continue;
        }
        const doc = MW.documents.createFromFile(f);
        MW.tabs.add(doc.id, { activate: false });
        last = doc; opened++;
      }
      if (last) MW.tabs.activate(last.id);
      if (opened && !silent) MW.notify.success(opened > 1 ? opened + ' fichiers ouverts' : 'Fichier ouvert');
      await MW.Store.refresh();
      MW.app.refreshAll();
      MW.editor.focus();
    },

    async openRecent(p) {
      const r = await window.api.files.openPaths([p]);
      if (!r[0].ok && ['E_NOT_FOUND'].includes(r[0].error.code)) {
        MW.notify.error('Fichier introuvable : ' + MW.basename(p), { action: { label: 'Retirer de la liste', onClick: () => this.removeRecent(p) } });
        return;
      }
      await this.openResults(r);
    },

    // ───────────── Enregistrement ─────────────
    async save(doc, { reason = 'manual' } = {}) {
      doc = doc || MW.editor.doc;
      if (!doc) return false;
      if (!doc.path || doc.externalState === 'deleted') return reason === 'autosave' ? false : this.saveAs(doc);
      if (doc.saving) { doc.resave = true; return false; }
      if (doc.externalState === 'changed' && reason === 'autosave') return false;
      MW.autosave.cancel(doc.id);
      const content = doc.content;
      doc.saving = true; doc.saveError = false; MW.app.statusChanged();
      try {
        const res = await window.api.files.save({ path: doc.path, content, encoding: doc.encoding, eol: doc.eol, expectedMtimeMs: doc.mtimeMs, expectedSize: doc.size, reason });
        if (res.conflict) {
          doc.saving = false;
          if (reason === 'autosave') { doc.externalState = 'changed'; doc.externalInfo = { mtimeMs: res.mtimeMs }; MW.app.refreshAll(); MW.notify.warn('« ' + doc.name + ' » a été modifié extérieurement : sauvegarde automatique suspendue.'); return false; }
          return await this.resolveSaveConflict(doc, res);
        }
        this._saved(doc, res, content);
        if (reason === 'manual') MW.notify.success('Fichier sauvegardé');
        return true;
      } catch (e) {
        doc.saveError = true;
        if (e.code === 'E_ENCODING') return await this._encodingFallback(doc, reason);
        MW.notify.error(reason === 'autosave' ? 'Sauvegarde automatique impossible : ' + err(e, '') : 'Impossible de sauvegarder le fichier. ' + err(e, ''));
        return false;
      } finally {
        doc.saving = false; MW.app.statusChanged();
        if (doc.resave) { doc.resave = false; if (doc.isDirty) this.save(doc, { reason: 'autosave' }); }
      }
    },

    _saved(doc, res, savedContent) {
      MW.documents.markSaved(doc.id, { savedContent, path: res.path, encoding: res.encoding, eol: res.eol, mtimeMs: res.mtimeMs, size: res.size, ino: res.ino });
      MW.app.scheduleRecovery(doc);
      MW.rpcBridge.flashSaving();
      MW.app.refreshAll();
    },

    async _encodingFallback(doc, reason) {
      if (reason === 'autosave') { MW.notify.error('Sauvegarde impossible : caractères incompatibles avec ' + doc.encoding + '.'); return false; }
      const ok = await MW.dialogs.confirm('Caractères non compatibles', 'Le document contient des caractères qui ne peuvent pas être enregistrés dans cet encodage. Enregistrer en UTF-8 ?', { ok: 'Enregistrer en UTF-8' });
      if (!ok) return false;
      MW.documents.update(doc.id, { encoding: 'utf8' });
      return this.save(doc, { reason });
    },

    async saveAs(doc) {
      doc = doc || MW.editor.doc;
      if (!doc) return false;
      const content = doc.content;
      try {
        const res = await window.api.files.saveAs({ suggestedName: doc.path ? doc.name : doc.name + '.' + doc.extension, defaultDir: doc.directory || null, content, encoding: doc.encoding, eol: doc.eol });
        if (!res) return false;
        const old = doc.path;
        if (old && !MW.samePath(old, res.path)) window.api.files.unwatch(old).catch(() => {});
        this._saved(doc, res, content);
        await MW.Store.refresh();
        MW.notify.success('Fichier sauvegardé');
        return true;
      } catch (e) {
        if (e.code === 'E_ENCODING') return this._encodingFallback(doc, 'manual');
        MW.notify.error('Impossible de sauvegarder le fichier. ' + err(e, ''));
        return false;
      }
    },

    async saveAll() {
      for (const d of MW.documents.dirtyDocs()) if (!(await this.save(d))) return;
    },

    /** Le fichier a changé sur le disque pendant l'édition : ne jamais perdre de données. */
    async resolveSaveConflict(doc, res) {
      const choice = await MW.dialogs.choose('Conflit de sauvegarde',
        'Le fichier « ' + doc.name + ' » a été modifié par une autre application depuis son ouverture. Que souhaitez-vous faire ?',
        [{ label: 'Annuler', value: null }, { label: 'Enregistrer comme nouveau fichier', value: 'copy' }, { label: 'Recharger la version disque', value: 'reload' }, { label: 'Conserver ma version', value: 'mine', variant: 'primary', default: true }]);
      if (choice === 'mine') return this.forceWrite(doc);
      if (choice === 'reload') { await this.reloadFromDisk(doc); return false; }
      if (choice === 'copy') return this.saveAs(doc);
      return false;
    },

    async forceWrite(doc) {
      const content = doc.content;
      try {
        const res = await window.api.files.write({ path: doc.path, content, encoding: doc.encoding, eol: doc.eol });
        this._saved(doc, res, content);
        MW.notify.success('Fichier sauvegardé (version du disque sauvegardée dans l’historique)');
        return true;
      } catch (e) { MW.notify.error('Impossible de sauvegarder le fichier. ' + err(e, '')); return false; }
    },

    // ───────────── Modifications externes ─────────────
    async onFileEvent(evt) {
      const doc = MW.documents.findByPath(evt.path);
      if (!doc) return;
      if (evt.type === 'moved') {
        MW.documents.setPath(doc.id, evt.newPath);
        doc.mtimeMs = evt.mtimeMs ?? doc.mtimeMs;
        MW.notify.info('Fichier déplacé ou renommé : ' + MW.basename(evt.newPath));
        MW.app.refreshAll(); return;
      }
      if (evt.type === 'deleted') {
        doc.externalState = 'deleted'; MW.autosave.cancel(doc.id);
        MW.notify.warn('« ' + doc.name + ' » n’existe plus sur le disque.');
      } else if (evt.type === 'changed') {
        try { // Contenu identique (simple « touch ») : on se resynchronise sans alerter
          const f = await window.api.files.read(doc.path, { watch: false });
          if (f.content === doc.savedContent && f.encoding === doc.encoding) { doc.mtimeMs = f.mtimeMs; doc.size = f.size; return; }
        } catch { /* illisible : on alerte quand même */ }
        doc.externalState = 'changed'; doc.externalInfo = { mtimeMs: evt.mtimeMs, size: evt.size }; MW.autosave.cancel(doc.id);
        MW.notify.warn('« ' + doc.name + ' » a été modifié extérieurement.');
      }
      MW.documents.refresh(doc.id);
      MW.app.refreshAll();
    },

    async reloadFromDisk(doc) {
      try {
        const f = await window.api.files.read(doc.path);
        const keepHistory = doc.history;
        const active = MW.editor.doc && MW.editor.doc.id === doc.id;
        if (active) { MW.editor.setContent(f.content, { keepSelection: true }); }
        else { MW.documents.setContent(doc.id, f.content); keepHistory.record(f.content, 0, 0); }
        MW.documents.markReloaded(doc.id, f); // l'état précédent reste accessible via Annuler (Ctrl+Z)
        MW.app.scheduleRecovery(doc); MW.app.refreshAll();
        MW.notify.info('Fichier rechargé depuis le disque');
      } catch (e) { MW.notify.error(err(e, 'Impossible de recharger le fichier.')); }
    },

    keepMine(doc) {
      const mt = doc.externalInfo && doc.externalInfo.mtimeMs;
      if (mt) doc.mtimeMs = mt;
      if (doc.externalInfo && doc.externalInfo.size != null) doc.size = doc.externalInfo.size;
      doc.externalState = null; doc.externalInfo = null; doc.forceDirty = true;
      MW.documents.refresh(doc.id);
      MW.app.refreshAll();
      MW.notify.info('Votre version est conservée ; elle remplacera celle du disque à la prochaine sauvegarde.');
    },

    async compare(doc) {
      let disk;
      try { disk = await window.api.files.read(doc.path, { watch: false }); } catch (e) { MW.notify.error(err(e, 'Lecture impossible.')); return; }
      const ops = MW.diffLines(disk.content, doc.content);
      const view = h('div', null,
        h('div', { class: 'legend' }, h('span', null, '− version du disque'), h('span', null, '+ votre version')),
        ops.every((o) => o.type === 'eq') ? h('p', { class: 'dim' }, 'Les deux versions sont identiques.') : h('div', { class: 'diff', tabindex: '0', role: 'region', 'aria-label': 'Différences' }, ops.map((o) => h('div', { class: o.type }, o.line))),
        ops.truncated ? h('p', { class: 'dim' }, 'Comparaison simplifiée : le document est trop volumineux pour un diff détaillé.') : null);
      const choice = await MW.dialogs.show({ title: 'Comparer — ' + doc.name, body: view, dismissValue: null, noEnter: true,
        buttons: [{ label: 'Fermer', value: null }, { label: 'Recharger la version disque', value: 'reload' }, { label: 'Conserver ma version', value: 'mine', variant: 'primary', default: true }] }).promise;
      if (choice === 'reload') this.reloadFromDisk(doc); else if (choice === 'mine') this.keepMine(doc);
    },

    // ───────────── Fermeture ─────────────
    /** Ferme des onglets en proposant d'enregistrer les documents modifiés. Renvoie false si annulé. */
    async closeTabs(ids) {
      for (const id of ids) {
        const doc = MW.documents.get(id);
        if (!doc) continue;
        if (doc.isDirty) {
          MW.tabs.activate(id);
          const c = await MW.dialogs.choose('Enregistrer les modifications ?', 'Le document « ' + doc.name + ' » contient des modifications non enregistrées.',
            [{ label: 'Annuler', value: null }, { label: 'Ne pas enregistrer', value: 'discard', variant: 'danger' }, { label: 'Enregistrer', value: 'save', variant: 'primary', default: true }]);
          if (c === null) return false;
          if (c === 'save' && !(await this.save(doc))) return false;
        }
        this._removeDoc(doc);
      }
      return true;
    },

    _removeDoc(doc) {
      MW.tabs.pushClosed({ path: doc.path, name: doc.name, content: !doc.path || doc.isDirty ? doc.content : null, encoding: doc.encoding, eol: doc.eol, extension: doc.extension, pinned: MW.tabs.isPinned(doc.id) });
      MW.autosave.cancel(doc.id);
      MW.app.clearRecovery(doc.id);
      if (doc.path) window.api.files.unwatch(doc.path).catch(() => {});
      MW.tabs.remove(doc.id);
      MW.documents.remove(doc.id);
    },

    async reopenClosed() {
      const s = MW.tabs.popClosed();
      if (!s) { MW.notify.info('Aucun onglet fermé à rouvrir.'); return; }
      if (s.path && s.content == null) { await this.openPaths([s.path], { track: false }); return; }
      const doc = s.path ? MW.documents.createFromFile({ path: s.path, name: s.name, directory: MW.dirname(s.path), extension: s.extension, content: s.content, encoding: s.encoding, eol: s.eol, mtimeMs: null, size: 0, ino: 0 }) : MW.documents.createUntitled({ content: s.content, extension: s.extension, encoding: s.encoding, eol: s.eol });
      if (s.path) { MW.documents.update(doc.id, { savedContent: '', forceDirty: true }); }
      MW.tabs.add(doc.id); if (s.pinned) MW.tabs.setPinned(doc.id, true);
      MW.app.scheduleRecovery(doc);
    },

    async duplicate(id) {
      const src = MW.documents.get(id); if (!src) return;
      const doc = MW.documents.createUntitled({ content: src.content, extension: src.extension, encoding: src.encoding, eol: src.eol });
      MW.documents.update(doc.id, { name: MW.stripExtension(src.name) + ' (copie)' });
      MW.tabs.add(doc.id, { afterActive: true });
      MW.app.scheduleRecovery(doc);
      MW.notify.success('Copie créée');
    },

    /** Prépare l'arrêt (fermeture ou installation d'une mise à jour) : enregistre / demande, nettoie. false = annulé. */
    async prepareQuit() {
      MW.autosave.cancelAll();
      if (MW.Store.settings.autosaveInterval > 0) for (const d of MW.documents.dirtyDocs()) if (d.path && !d.externalState) await this.save(d, { reason: 'autosave' });
      for (const d of MW.documents.dirtyDocs()) {
        MW.tabs.activate(d.id);
        const c = await MW.dialogs.choose('Enregistrer les modifications ?', 'Le document « ' + d.name + ' » contient des modifications non enregistrées.',
          [{ label: 'Annuler', value: null }, { label: 'Ne pas enregistrer', value: 'discard', variant: 'danger' }, { label: 'Enregistrer', value: 'save', variant: 'primary', default: true }]);
        if (c === null) return false;
        if (c === 'save' && !(await this.save(d))) return false;
      }
      await MW.app.saveSession();
      await window.api.recovery.clear('*').catch(() => {});
      return true;
    },

    /** Fermeture de la fenêtre : propose d'enregistrer, nettoie la récupération puis confirme à main. */
    async requestWindowClose() {
      if (this.closing) return;
      this.closing = true;
      try { if (await this.prepareQuit()) await window.api.window.confirmClose(); } finally { this.closing = false; }
    },

    // ───────────── Divers ─────────────
    tabMenu(x, y, id) {
      const doc = MW.documents.get(id); if (!doc) return;
      const pinned = MW.tabs.isPinned(id);
      const fav = doc.path && MW.Store.settings.favorites.some((f) => MW.samePath(f.path, doc.path));
      MW.contextMenu.show(x, y, [
        { label: 'Fermer', shortcut: 'Ctrl+W', run: () => this.closeTabs([id]) },
        { label: 'Fermer les autres', run: () => this.closeTabs(MW.tabs.idsOthers(id)) },
        { label: 'Fermer à droite', run: () => this.closeTabs(MW.tabs.idsRight(id)) },
        { label: 'Fermer tous', run: () => this.closeTabs(MW.tabs.idsAll()) },
        { separator: true },
        { label: pinned ? 'Désépingler' : 'Épingler', run: () => MW.tabs.togglePin(id) },
        { label: 'Dupliquer', run: () => this.duplicate(id) },
        { label: 'Réouvrir l’onglet fermé', shortcut: 'Ctrl+Maj+T', run: () => this.reopenClosed() },
        { separator: true },
        { label: 'Enregistrer sous…', run: () => this.saveAs(doc) },
        { label: fav ? 'Retirer des favoris' : 'Ajouter aux favoris', disabled: !doc.path, run: () => this.toggleFavorite(doc.path) },
        { label: 'Afficher dans l’explorateur', disabled: !doc.path, run: () => this.reveal(doc.path) },
        { label: 'Copier le chemin', disabled: !doc.path, run: () => navigator.clipboard.writeText(doc.path).then(() => MW.notify.success('Chemin copié')) },
        { label: 'Mettre le fichier à la corbeille', danger: true, disabled: !doc.path, run: () => this.trash(doc) },
      ]);
    },

    async trash(doc) {
      if (!(await MW.dialogs.confirm('Mettre à la corbeille', 'Déplacer « ' + doc.name + ' » dans la corbeille ? Le contenu reste dans l’éditeur.', { ok: 'Mettre à la corbeille', danger: true }))) return;
      try { await window.api.files.delete(doc.path); MW.notify.success('Fichier placé dans la corbeille'); } catch (e) { MW.notify.error(err(e, 'Opération impossible.')); }
    },

    async reveal(p) { try { await window.api.files.reveal(p); } catch (e) { MW.notify.error(err(e, 'Dossier introuvable.')); } },
    async toggleFavorite(p) {
      if (!p) return;
      const fav = MW.Store.settings.favorites.some((f) => MW.samePath(f.path, p));
      try { await (fav ? window.api.favorites.remove(p) : window.api.favorites.add(p)); await MW.Store.refresh(); MW.notify.success(fav ? 'Retiré des favoris' : 'Ajouté aux favoris'); } catch (e) { MW.notify.error(err(e, 'Opération impossible.')); }
    },
    async removeRecent(p) { await window.api.recent.remove(p); await MW.Store.refresh(); },
    async clearRecent() { await window.api.recent.clear(); await MW.Store.refresh(); MW.notify.info('Historique effacé'); },
  };

  MW.fileActions = FA;
})();
