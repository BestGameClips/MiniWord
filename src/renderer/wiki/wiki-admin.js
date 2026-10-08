(function () {
  const MW = window.MW; const { h, icon } = MW;

  const A = {
    dlg: null, pages: [], slug: null, isNew: false, ui: {},

    async open() {
      if (this.dlg) return;
      let st = await window.api.wiki.adminState();
      if (!st.admin) {
        if (!st.passwordRequired) { MW.notify.warn('Accès administrateur indisponible : activez le mode développeur ou définissez un mot de passe admin (app.config.js).'); return; }
        const pw = await MW.dialogs.prompt('Rôle administrateur', 'Mot de passe administrateur', '');
        if (pw === null) return;
        if (!(await window.api.wiki.unlock(pw))) { MW.notify.error('Mot de passe incorrect.'); return; }
        st = await window.api.wiki.adminState();
        if (!st.admin) return;
      }
      await this.build();
    },

    async build() {
      const ui = this.ui = {};
      const info = await window.api.wiki.info();
      ui.list = h('div', { class: 'wiki-list' });
      ui.slug = h('input', { class: 'field-input', placeholder: 'nom-de-la-page', 'aria-label': 'Identifiant de la page' });
      ui.text = h('textarea', { class: 'adm-text', spellcheck: 'false', 'aria-label': 'Contenu Markdown', onInput: MW.debounce(() => this.preview(), 150) });
      ui.prev = h('div', { class: 'md-body adm-prev', 'data-md-theme': MW.Store.settings.mdPreviewTheme });
      ui.info = h('div', { class: 'wiki-status' });
      ui.save = h('button', { class: 'btn primary small', onClick: () => this.save() }, 'Enregistrer');
      ui.del = h('button', { class: 'btn danger small', onClick: () => this.remove() }, 'Supprimer');
      ui.push = h('button', { class: 'btn small', onClick: () => this.push() }, 'Publier sur GitHub');
      ui.storage = h('select', { class: 'field', 'aria-label': 'Stockage des pages', onChange: async () => { await MW.Store.set({ wikiStorage: ui.storage.value }).catch((e) => MW.notify.error(e.message)); this.load(); } },
        [['files', 'Fichiers Markdown locaux'], ['sqlite', 'Base SQLite']].map(([v, l]) => h('option', { value: v, selected: MW.Store.settings.wikiStorage === v ? true : null }, l)));
      ui.sync = h('input', { type: 'checkbox', checked: MW.Store.settings.wikiGithubSync ? true : null, disabled: !info.repo ? true : null, onChange: () => MW.Store.set({ wikiGithubSync: ui.sync.checked }) });
      ui.token = h('input', { class: 'field-input', type: 'password', placeholder: info.hasToken ? 'Jeton enregistré (••••)' : 'Jeton GitHub (scope repo)', style: { width: '210px' }, 'aria-label': 'Jeton GitHub' });
      const tokenBtn = h('button', { class: 'btn small', onClick: async () => { try { await window.api.wiki.setGithubToken(ui.token.value); ui.token.value = ''; MW.notify.success('Jeton enregistré (chiffré par le système).'); } catch (e) { MW.notify.error(e.message); } } }, 'Enregistrer le jeton');
      const side = h('div', { class: 'wiki-side' }, h('div', { class: 'wiki-side-head' }, h('button', { class: 'btn small primary', style: { width: '100%' }, onClick: () => this.create() }, icon('plus', 14), 'Nouvelle page')), ui.list);
      const main = h('div', { class: 'wiki-main' },
        h('div', { class: 'wiki-top' }, h('div', null, h('h1', { class: 'wiki-title' }, 'Administration du Wiki'), h('div', { class: 'wiki-meta' }, 'Créer, modifier et supprimer des pages sans toucher au code')), h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onClick: () => this.dlg.close() }, icon('x', 18))),
        h('div', { class: 'adm-bar' }, ui.slug, ui.save, ui.del, ui.push),
        h('div', { class: 'adm-split' }, ui.text, ui.prev),
        h('div', { class: 'adm-foot' }, h('label', null, 'Stockage ', ui.storage), h('label', { class: 'chk' }, ui.sync, ' Publier sur GitHub à chaque enregistrement'), h('span', { class: 'sb-spacer' }), ui.token, tokenBtn),
        ui.info);
      this.dlg = MW.dialogs.show({ raw: true, className: 'wiki admin', dismissValue: null, noEnter: true, body: h('div', { style: { display: 'contents' } }, side, main), onClose: () => { this.dlg = null; } });
      ui.info.textContent = info.repo ? 'Dépôt : ' + info.repo + (info.hasToken ? ' · jeton présent' : ' · aucun jeton (publication GitHub impossible)') : 'Aucun dépôt GitHub configuré : les pages restent locales.';
      await this.load();
    },

    async load(select) {
      this.pages = await window.api.wiki.list();
      MW.clear(this.ui.list);
      this.pages.forEach((p) => this.ui.list.append(h('button', { class: 'wiki-item', 'aria-current': String(p.slug === this.slug && !this.isNew), onClick: () => this.pick(p.slug) }, h('span', null, p.title), h('span', { class: 'src src-' + p.source }, { bundled: 'Livrée', remote: 'GitHub', local: 'Locale' }[p.source]))));
      const want = select || this.slug || (this.pages[0] && this.pages[0].slug);
      if (want && this.pages.some((p) => p.slug === want)) await this.pick(want); else this.create();
    },

    async pick(slug) {
      const page = await window.api.wiki.get(slug);
      this.slug = slug; this.isNew = false;
      this.ui.slug.value = slug; this.ui.slug.readOnly = true; this.ui.text.value = page.content;
      this.ui.del.disabled = page.source !== 'local'; this.ui.del.title = page.source !== 'local' ? 'Seules les pages locales se suppriment (celle-ci vient de « ' + page.source + ' »). Enregistrer crée une version locale prioritaire.' : '';
      this.ui.push.disabled = false;
      this.preview(); [...this.ui.list.children].forEach((b, i) => b.setAttribute('aria-current', String(this.pages[i] && this.pages[i].slug === slug)));
    },

    create() {
      this.isNew = true; this.slug = null;
      this.ui.slug.readOnly = false; this.ui.slug.value = ''; this.ui.slug.focus();
      this.ui.text.value = '# Nouvelle page\n\nContenu en **Markdown**.\n'; this.ui.del.disabled = true; this.ui.push.disabled = true; this.preview();
    },

    preview() { MW.mdView(this.ui.prev, this.ui.text.value); },

    async save() {
      let slug = this.ui.slug.value.trim();
      if (this.isNew && !slug) slug = this.ui.slug.value = MW.markdownTitle(this.ui.text.value, 'page').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
      try {
        const r = await window.api.wiki.save({ slug, content: this.ui.text.value });
        MW.notify.success('Page enregistrée' + (r.pushed ? (r.pushed.ok ? ' et publiée sur GitHub' : ' (GitHub : ' + r.pushed.message + ')') : ''));
        this.isNew = false; this.slug = slug; await this.load(slug); MW.wiki.dlg && MW.wiki.refreshList(MW.wiki.current);
      } catch (e) { MW.notify.error(e.message); }
    },

    async remove() {
      if (!this.slug || !(await MW.dialogs.confirm('Supprimer la page', 'Supprimer la page locale « ' + this.slug + ' » ? Une version livrée ou GitHub éventuelle réapparaîtra.', { ok: 'Supprimer', danger: true }))) return;
      try { await window.api.wiki.delete(this.slug); MW.notify.success('Page supprimée'); this.slug = null; await this.load(); MW.wiki.dlg && MW.wiki.refreshList(); } catch (e) { MW.notify.error(e.message); }
    },

    async push() {
      try { const r = await window.api.wiki.push(this.slug); MW.notify.success(r.message); } catch (e) { MW.notify.error(e.message); }
    },
  };
  MW.wikiAdmin = A;
})();
