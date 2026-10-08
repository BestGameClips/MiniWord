(function () {
  const MW = window.MW; const { h, icon } = MW;
  const SRC = { bundled: 'Livrée', remote: 'GitHub', local: 'Locale' };

  const W = {
    dlg: null, pages: [], current: null, ui: {},

    async open(slug) {
      if (this.dlg) { if (slug) this.show(slug); return; }
      const ui = this.ui = {};
      ui.search = h('input', { class: 'field-input', placeholder: 'Filtrer les pages…', 'aria-label': 'Filtrer les pages', onInput: () => this.renderList() });
      ui.list = h('nav', { class: 'wiki-list', 'aria-label': 'Pages du wiki' });
      ui.title = h('h1', { class: 'wiki-title' });
      ui.meta = h('div', { class: 'wiki-meta' });
      ui.body = h('div', { class: 'md-body', tabindex: '0' });
      ui.status = h('div', { class: 'wiki-status', 'aria-live': 'polite' });
      ui.reload = h('button', { class: 'btn small', 'aria-label': 'Recharger les pages depuis GitHub', 'data-tip': 'Forcer la synchronisation', onClick: () => this.reload() }, '↻ Recharger');
      ui.online = h('button', { class: 'btn small ghost', hidden: true, onClick: () => window.api.app.openExternal(this.info.onlineUrl).catch((e) => MW.notify.error(e.message)) }, 'Ouvrir en ligne');
      ui.admin = h('button', { class: 'btn small', hidden: true, onClick: () => MW.wikiAdmin.open() }, 'Administration');
      const side = h('div', { class: 'wiki-side' }, h('div', { class: 'wiki-side-head' }, ui.search), ui.list);
      const main = h('div', { class: 'wiki-main', 'data-md-theme': MW.Store.settings.mdPreviewTheme },
        h('div', { class: 'wiki-top' }, h('div', null, ui.title, ui.meta), h('div', { class: 'wiki-actions' }, ui.reload, ui.online, ui.admin, h('button', { class: 'icon-btn', 'aria-label': 'Fermer le wiki', onClick: () => this.dlg.close() }, icon('x', 18)))),
        ui.body, ui.status);
      this.dlg = MW.dialogs.show({ raw: true, className: 'wiki', dismissValue: null, noEnter: true, body: h('div', { style: { display: 'contents' } }, side, main), onClose: () => { this.dlg = null; this.unsub && this.unsub(); } });
      this.unsub = window.api.wiki.onUpdated((r) => { if (this.dlg) { this.status(r.message, r.ok); this.refreshList(this.current); } });
      await this.refreshList(slug);
      this.info = await window.api.wiki.info();
      ui.online.hidden = !this.info.onlineUrl;
      const st = await window.api.wiki.adminState();
      ui.admin.hidden = !(st.admin || st.passwordRequired);
      this.status(this.info.remoteEnabled ? 'Synchronisé avec ' + this.info.repo + (this.info.lastRefresh ? ' — ' + new Date(this.info.lastRefresh.at).toLocaleTimeString('fr-FR') : '') : 'Wiki local : renseignez github.owner/repo dans app.config.js pour la synchronisation GitHub.', true);
    },

    status(msg, ok) { if (this.ui.status) { this.ui.status.textContent = msg; this.ui.status.className = 'wiki-status ' + (ok ? 'ok' : 'warn'); } },

    async refreshList(select) {
      try { this.pages = await window.api.wiki.list(); } catch (e) { MW.notify.error(e.message); return; }
      this.renderList();
      const want = select || (this.pages.find((p) => p.slug === this.current) ? this.current : (this.pages[0] && this.pages[0].slug));
      if (want) await this.show(want);
    },

    renderList() {
      const q = this.ui.search.value.trim().toLowerCase();
      MW.clear(this.ui.list);
      this.pages.filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.includes(q)).forEach((p) => {
        this.ui.list.append(h('button', { class: 'wiki-item', 'aria-current': String(p.slug === this.current), onClick: () => this.show(p.slug) }, h('span', null, p.title), h('span', { class: 'src src-' + p.source }, SRC[p.source])));
      });
      if (!this.ui.list.children.length) this.ui.list.append(h('div', { class: 'sb-empty', style: { paddingLeft: '10px' } }, 'Aucune page'));
    },

    async show(slug) {
      try {
        const page = await window.api.wiki.get(slug);
        this.current = slug;
        this.ui.title.textContent = page.title;
        this.ui.meta.textContent = SRC[page.source] + ' · modifiée le ' + new Date(page.updatedAt).toLocaleDateString('fr-FR');
        MW.mdView(this.ui.body, page.content, { onInternal: (s) => this.pages.some((p) => p.slug === s) ? this.show(s) : MW.notify.info('Page « ' + s + ' » introuvable.') });
        this.ui.body.scrollTop = 0; this.renderList();
      } catch (e) { MW.notify.error(e.message); }
    },

    async reload() {
      this.ui.reload.disabled = true; this.ui.reload.textContent = '↻ Rechargement…';
      try { const r = await window.api.wiki.refresh(); this.status(r.message, r.ok); (r.ok ? MW.notify.success : MW.notify.warn)(r.message); await this.refreshList(this.current); }
      catch (e) { MW.notify.error(e.message); }
      this.ui.reload.disabled = false; this.ui.reload.textContent = '↻ Recharger';
    },
  };
  MW.wiki = W;
})();
