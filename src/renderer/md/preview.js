(function () {
  const MW = window.MW; const { h } = MW;
  const THEMES = [['neon', 'Néon'], ['glass', 'Verre'], ['paper', 'Papier']];

  /** HTML interprété par shared/markdown.js (échappé par construction) → conteneur stylé + liens sécurisés. */
  MW.mdView = function (container, md, { onInternal } = {}) {
    container.innerHTML = MW.renderMarkdown(md);
    container.querySelectorAll('a[data-md-link]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const href = a.getAttribute('href') || '';
        if (/^https:\/\//i.test(href)) window.api.app.openExternal(href).catch((er) => MW.notify.error(er.message));
        else if (href.startsWith('#')) { const t = container.querySelector('[id="' + href.slice(1).replace(/"/g, '') + '"]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        else if (/^mailto:/i.test(href)) { /* non ouvert : pas de client mail intégré */ }
        else if (onInternal) onInternal(href.replace(/^\.?\/*/, '').replace(/\.md$/, ''));
      });
    });
  };

  const P = {
    open: false, body: null, pane: null,
    init() {
      this.pane = document.getElementById('preview-pane');
      const render = MW.debounce(() => this.render(), 150);
      MW.documents.on('content', render); MW.tabs.on('change', render); MW.Store.on('change', (p) => { if ('mdPreviewTheme' in p) this.render(); });
      this.update = render;
    },
    toggle() { this.open ? this.close() : this.show(); },
    show() {
      this.open = true; this.pane.hidden = false;
      this.body = h('div', { class: 'md-body', tabindex: '0', 'aria-label': 'Contenu de l’aperçu' });
      const themeBtns = h('div', { class: 'seg', role: 'group', 'aria-label': 'Thème de l’aperçu' }, THEMES.map(([id, label]) =>
        h('button', { class: 'seg-btn', 'aria-pressed': String(MW.Store.settings.mdPreviewTheme === id), onClick: () => MW.Store.set({ mdPreviewTheme: id }).then(() => this.show()) }, label)));
      MW.clear(this.pane);
      this.pane.append(h('div', { class: 'pv-head' }, h('span', { class: 'pv-title' }, 'Aperçu Markdown'), themeBtns,
        h('button', { class: 'icon-btn', 'aria-label': 'Fermer l’aperçu', onClick: () => this.close() }, MW.icon('x', 16))), this.body);
      this.render();
      const ta = document.getElementById('editor');
      if (!this._sync) { this._sync = true; ta.addEventListener('scroll', () => { if (!this.open) return; const r = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight); this.body.scrollTop = r * (this.body.scrollHeight - this.body.clientHeight); }); }
    },
    close() { this.open = false; this.pane.hidden = true; MW.clear(this.pane); },
    render() {
      if (!this.open) return;
      this.pane.dataset.mdTheme = MW.Store.settings.mdPreviewTheme;
      const d = MW.editor.doc;
      if (!d) { this.body.innerHTML = '<p class="md-empty">Aucun document ouvert.</p>'; return; }
      MW.mdView(this.body, d.content);
    },
  };
  MW.mdPreview = P;
})();
