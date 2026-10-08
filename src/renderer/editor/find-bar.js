(function () {
  const MW = window.MW; const { h, icon } = MW;

  const F = {
    open: false, mode: 'find', matches: [], index: -1, opts: { caseSensitive: false, wholeWord: false, regex: false },
    els: {}, query: '', replacement: '',

    init() {
      const area = document.getElementById('findbar-area');
      const mk = (cls, label, text, fn, tip) => h('button', { class: cls, 'aria-label': label, 'data-tip': tip || label, onClick: fn }, text);
      const e = this.els;
      e.find = h('input', { 'aria-label': 'Rechercher', placeholder: 'Rechercher', spellcheck: 'false', onInput: () => { this.query = e.find.value; this.refresh({ select: true }); }, onKeydown: (ev) => this._key(ev, 'find') });
      e.repl = h('input', { 'aria-label': 'Remplacer par', placeholder: 'Remplacer par', spellcheck: 'false', onInput: () => { this.replacement = e.repl.value; }, onKeydown: (ev) => this._key(ev, 'repl') });
      e.count = h('span', { class: 'fb-count', 'aria-live': 'polite' });
      e.wrapFind = h('div', { class: 'fb-input-wrap' }, e.find, e.count);
      e.cs = mk('fb-toggle', 'Respecter la casse', 'Aa', () => this._toggle('caseSensitive', e.cs));
      e.ww = mk('fb-toggle', 'Mot entier', 'ab', () => this._toggle('wholeWord', e.ww), 'Mot entier');
      e.re = mk('fb-toggle', 'Expression régulière', '.*', () => this._toggle('regex', e.re));
      [e.cs, e.ww, e.re].forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.toggleRepl = h('button', { class: 'icon-btn', 'aria-label': 'Afficher le remplacement', onClick: () => this.show(this.mode === 'find' ? 'replace' : 'find') }, icon('chevronRight', 16));
      e.prev = h('button', { class: 'icon-btn', 'aria-label': 'Résultat précédent', 'data-tip': 'Précédent (Maj+F3)', onClick: () => this.step(-1) }, icon('arrowUp', 16));
      e.next = h('button', { class: 'icon-btn', 'aria-label': 'Résultat suivant', 'data-tip': 'Suivant (F3)', onClick: () => this.step(1) }, icon('arrowDown', 16));
      e.close = h('button', { class: 'icon-btn', 'aria-label': 'Fermer la recherche', 'data-tip': 'Fermer (Échap)', onClick: () => this.hide() }, icon('x', 16));
      e.rRepl = h('button', { class: 'btn small', onClick: () => this.replaceCurrent(false) }, 'Remplacer');
      e.rNext = h('button', { class: 'btn small', onClick: () => this.replaceCurrent(true) }, 'Remplacer et suivant');
      e.rAll = h('button', { class: 'btn small', onClick: () => this.replaceAll() }, 'Remplacer tout');
      e.replRow = h('div', { class: 'fb-row' }, h('div', { class: 'fb-input-wrap' }, e.repl), e.rRepl, e.rNext, e.rAll);
      e.root = h('div', { class: 'findbar', role: 'search', hidden: true },
        h('div', { class: 'fb-row' }, e.toggleRepl, e.wrapFind, e.cs, e.ww, e.re, e.prev, e.next, e.close), e.replRow);
      area.append(e.root);
    },

    _toggle(key, btn) { this.opts[key] = !this.opts[key]; btn.setAttribute('aria-pressed', String(this.opts[key])); this.refresh({ select: true }); },

    _key(ev, which) {
      if (ev.key === 'Enter') { ev.preventDefault(); if (which === 'find') this.step(ev.shiftKey ? -1 : 1); else this.replaceCurrent(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); this.hide(); }
    },

    show(mode) {
      const e = this.els;
      this.mode = mode; this.open = true;
      e.root.hidden = false;
      e.replRow.hidden = mode !== 'replace';
      e.toggleRepl.firstChild.style.transform = mode === 'replace' ? 'rotate(90deg)' : '';
      const sel = MW.editor.getSelectedText();
      if (sel && !sel.includes('\n') && sel.length <= 120) { e.find.value = sel; this.query = sel; }
      e.find.focus(); e.find.select();
      this.refresh({ select: true });
      MW.rpcBridge && MW.rpcBridge.refresh();
    },

    hide() {
      if (!this.open) return;
      this.open = false; this.els.root.hidden = true;
      MW.editor.setHighlights([], -1);
      MW.editor.focus();
      MW.rpcBridge && MW.rpcBridge.refresh();
    },

    /** Recalcule les résultats (changement de requête, de document ou de contenu). */
    refresh({ select = false } = {}) {
      if (!this.open) return;
      const doc = MW.editor.doc, e = this.els;
      if (!doc) { this.matches = []; this.index = -1; this._ui(null); return; }
      const res = MW.findAll(MW.editor.getValue(), this.query, this.opts);
      this.matches = res.matches;
      e.wrapFind.classList.toggle('error', !!res.error);
      if (select) {
        const caret = MW.editor.getSelection().start;
        let i = this.matches.findIndex((m) => m.end > caret || m.start >= caret);
        this.index = this.matches.length ? (i < 0 ? 0 : i) : -1;
      } else this.index = Math.min(this.index, this.matches.length - 1);
      this._ui(res);
      MW.editor.setHighlights(this.matches, this.index);
      if (select && this.index >= 0) this._reveal();
    },

    _ui(res) {
      const e = this.els;
      if (res && res.error) e.count.textContent = res.error;
      else if (!this.query) e.count.textContent = '';
      else e.count.textContent = this.matches.length ? (this.index + 1) + ' sur ' + this.matches.length + (res && res.truncated ? '+' : '') : 'Aucun résultat';
      const none = !this.matches.length;
      [e.prev, e.next, e.rRepl, e.rNext, e.rAll].forEach((b) => { b.disabled = none; });
    },

    _reveal() {
      const m = this.matches[this.index];
      if (!m) return;
      MW.editor.setSelection(m.start, m.end);
      MW.editor.setHighlights(this.matches, this.index);
      MW.editor.revealCurrentMatch();
      this._ui(null);
      this.els.count.textContent = (this.index + 1) + ' sur ' + this.matches.length;
    },

    step(dir) {
      if (!this.open) { this.show(this.mode); return; }
      if (!this.matches.length) return;
      this.index = (this.index + dir + this.matches.length) % this.matches.length;
      this._reveal();
    },

    replaceCurrent(thenNext) {
      const m = this.matches[this.index];
      if (!m) return;
      const text = MW.editor.getValue();
      const r = MW.replaceOne(text, m, this.query, this.replacement, this.opts);
      MW.editor.applyEdit({ from: 0, to: text.length, insert: r.text, selStart: m.start, selEnd: r.replacedEnd });
      this.refresh();
      if (thenNext) {
        const i = this.matches.findIndex((x) => x.start >= r.replacedEnd);
        this.index = this.matches.length ? (i < 0 ? 0 : i) : -1;
      } else {
        const i = this.matches.findIndex((x) => x.start >= m.start);
        this.index = this.matches.length ? (i < 0 ? 0 : i) : -1;
      }
      MW.editor.setHighlights(this.matches, this.index);
      if (thenNext && this.index >= 0) this._reveal();
      this._ui(null); this.els.count.textContent = this.matches.length ? (this.index + 1) + ' sur ' + this.matches.length : 'Aucun résultat';
    },

    replaceAll() {
      if (!this.query) return;
      const text = MW.editor.getValue();
      let r;
      try { r = MW.replaceAll(text, this.query, this.replacement, this.opts); } catch { MW.notify.error('Expression régulière invalide.'); return; }
      if (!r.count) return;
      MW.editor.applyEdit({ from: 0, to: text.length, insert: r.text, selStart: 0, selEnd: 0 });
      this.refresh();
      MW.notify.success(r.count + (r.count > 1 ? ' remplacements effectués' : ' remplacement effectué'));
    },
  };

  MW.findBar = F;
})();
