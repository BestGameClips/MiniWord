(function () {
  const MW = window.MW; const { h, icon } = MW;
  const BADGES = [['license', 'Licence'], ['version', 'Version'], ['node', 'Node.js'], ['build', 'Build'], ['stars', 'Étoiles'], ['issues', 'Issues'], ['discord', 'Discord']];

  const R = {
    dlg: null,
    open() {
      if (this.dlg) return;
      const d = this.data = { name: MW.Store.info.name, emoji: '', tagline: '', description: '', githubUser: '', githubRepo: '', license: 'MIT', version: MW.Store.info.version, features: '', installCmd: 'npm install\nnpm run dev', usageText: '', configText: '', roadmap: '', author: '', contact: '', screenshotUrl: '', discordInvite: '', toc: true, sections: ['features', 'install', 'usage', 'contributing', 'license'], badges: ['license', 'version'] };
      const upd = MW.debounce(() => this.update(), 120);
      const bind = (el, key) => { el.addEventListener('input', () => { d[key] = el.value; upd(); }); return el; };
      const txt = (label, key, ph, rows) => h('label', { class: 'rb-f' }, label, bind(rows ? h('textarea', { class: 'field-input rb-ta', rows, placeholder: ph || '' }, d[key]) : h('input', { class: 'field-input', placeholder: ph || '', value: d[key] }), key));
      const checks = (label, list, key) => h('fieldset', { class: 'rb-fs' }, h('legend', null, label), h('div', { class: 'rb-checks' }, list.map(([id, l]) => {
        const c = h('input', { type: 'checkbox', checked: d[key].includes(id) ? true : null, onChange: () => { d[key] = c.checked ? [...new Set([...d[key], id])] : d[key].filter((x) => x !== id); upd(); } }); return h('label', { class: 'chk' }, c, ' ' + l); })));
      this.tplSel = h('select', { class: 'field', 'aria-label': 'Gabarit', onChange: () => { const t = MW.README_TEMPLATES[this.tplSel.value]; if (t) { Object.assign(d, JSON.parse(JSON.stringify(t.data))); this.dlg.close(null); this.dlg = null; const keep = Object.assign({}, d); this.open(); Object.assign(this.data, keep); this.update(); } } },
        h('option', { value: '' }, 'Gabarit…'), Object.entries(MW.README_TEMPLATES).map(([k, t]) => h('option', { value: k }, t.label)));
      const lic = h('select', { class: 'field', onChange: () => { d.license = lic.value; upd(); } }, Object.entries(MW.README_LICENSES).map(([k, l]) => h('option', { value: k, selected: d.license === k ? true : null }, l)));
      const form = h('div', { class: 'rb-form' }, this.tplSel,
        txt('Nom du projet', 'name'), txt('Emoji (optionnel)', 'emoji', '🚀'), txt('Slogan', 'tagline', 'Une phrase qui résume le projet'), txt('Description', 'description', '', 3),
        h('div', { class: 'rb-row' }, txt('Utilisateur GitHub', 'githubUser', 'moi'), txt('Dépôt', 'githubRepo', 'mon-projet')),
        h('div', { class: 'rb-row' }, h('label', { class: 'rb-f' }, 'Licence', lic), txt('Version', 'version')),
        checks('Badges', BADGES, 'badges'), checks('Sections', MW.README_SECTIONS, 'sections'),
        txt('Fonctionnalités (une par ligne)', 'features', '', 4), txt('Commandes d’installation', 'installCmd', '', 3), txt('Utilisation', 'usageText', '', 3), txt('Configuration', 'configText', '', 3),
        txt('Feuille de route (une par ligne)', 'roadmap', '', 3), txt('Capture d’écran (URL)', 'screenshotUrl', 'https://…'), txt('Invitation Discord', 'discordInvite', 'https://discord.gg/…'), h('div', { class: 'rb-row' }, txt('Auteur', 'author'), txt('Contact', 'contact')));
      this.view = h('div', { class: 'md-body', 'data-md-theme': MW.Store.settings.mdPreviewTheme });
      this.src = h('pre', { class: 'rb-src', tabindex: '0' });
      this.mode = 'preview';
      const tabs = h('div', { class: 'seg' }, [['preview', 'Aperçu'], ['source', 'Markdown']].map(([id, l]) => h('button', { class: 'seg-btn', 'aria-pressed': String(id === 'preview'), onClick: (e) => { this.mode = id; this.view.hidden = id !== 'preview'; this.src.hidden = id !== 'source'; e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, l)));
      this.src.hidden = true;
      const pane = h('div', { class: 'rb-pane' }, h('div', { class: 'rb-pane-head' }, h('strong', null, 'README.md'), tabs, h('span', { class: 'sb-spacer' }),
        h('button', { class: 'btn small', onClick: async () => { await navigator.clipboard.writeText(this.md); MW.notify.success('README copié'); } }, 'Copier'),
        h('button', { class: 'btn small primary', onClick: () => this.insert() }, 'Créer le document'),
        h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onClick: () => this.dlg.close() }, icon('x', 18))), this.view, this.src);
      this.dlg = MW.dialogs.show({ raw: true, className: 'wiki readme', dismissValue: null, noEnter: true, title: null, body: h('div', { style: { display: 'contents' } }, form, pane), onClose: () => { this.dlg = null; } });
      this.update();
    },
    update() { if (!this.dlg) return; this.md = MW.generateReadme(this.data); this.src.textContent = this.md; MW.mdView(this.view, this.md); },
    insert() {
      const doc = MW.documents.createUntitled({ content: this.md, extension: 'md' });
      MW.documents.update(doc.id, { name: 'README.md', forceDirty: true });
      MW.tabs.add(doc.id, { afterActive: true }); MW.app.scheduleRecovery(doc); this.dlg.close(); MW.notify.success('README créé : enregistrez-le avec Ctrl+S');
    },
  };
  MW.readmeBuilder = R;
})();
