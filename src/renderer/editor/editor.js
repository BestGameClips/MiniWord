(function () {
  const MW = window.MW; const U = MW;
  const LAYER_MAX = 200000; // au-delà, pas de caractères invisibles ni de surbrillance globale

  const E = {
    ta: null, layer: null, wrap: null, doc: null, hl: { matches: [], current: -1 }, cb: {}, layerQueued: false,

    init(callbacks) {
      this.cb = callbacks;
      this.ta = document.getElementById('editor');
      this.layer = document.getElementById('editor-layer');
      this.wrap = document.getElementById('editor-wrap');
      const ta = this.ta;

      ta.addEventListener('input', (e) => this._onInput(e));
      ta.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'historyUndo') { e.preventDefault(); this.undo(); }
        else if (e.inputType === 'historyRedo') { e.preventDefault(); this.redo(); }
      });
      ta.addEventListener('keydown', (e) => this._onKeydown(e));
      this.gutter = document.getElementById('editor-gutter');
      this.measure = document.getElementById('editor-measure');
      ta.addEventListener('scroll', () => {
        this.layer.scrollTop = ta.scrollTop; this.layer.scrollLeft = ta.scrollLeft; this.gutter.scrollTop = ta.scrollTop;
        if (this.doc) { this.doc.scrollTop = ta.scrollTop; this.doc.scrollLeft = ta.scrollLeft; }
      });
      ta.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); this.cb.onZoom && this.cb.onZoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
      ta.addEventListener('contextmenu', (e) => { e.preventDefault(); this.cb.onContextMenu && this.cb.onContextMenu(e); });
      ta.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });

      let q = false;
      document.addEventListener('selectionchange', () => {
        if (document.activeElement !== ta || q) return;
        q = true;
        requestAnimationFrame(() => { q = false; this._saveSelection(); this._markGutterLine(); this.cb.onSelection && this.cb.onSelection(); });
      });
      new ResizeObserver(() => this._queueLayer()).observe(this.wrap);
    },

    applySettings() {
      const s = this.cb.getSettings();
      this.wrap.parentElement.dataset.wrap = s.wordWrap ? 'on' : 'off';
      this.ta.wrap = s.wordWrap ? 'soft' : 'off';
      this._queueLayer();
    },

    // ── Numéros de ligne (hauteurs mesurées sur un miroir pour suivre le retour à la ligne) ──
    _renderGutter() {
      const s = this.cb.getSettings(), g = this.gutter, ta = this.ta;
      const on = s.showLineNumbers && !!this.doc;
      g.hidden = !on; this.wrap.dataset.gutter = on ? 'on' : 'off';
      if (!on) { if (g.firstChild) g.textContent = ''; return; }
      const lines = ta.value.split('\n'), n = lines.length;
      const digits = String(n).length;
      this.wrap.style.setProperty('--gutter-w', Math.round(digits * parseFloat(getComputedStyle(ta).fontSize) * 0.62 + 30) + 'px');
      let heights = null;
      if (s.wordWrap && n <= 20000) {
        this.measure.innerHTML = lines.map((l) => '<div>' + (l ? U.escapeHtml(l) : ' ') + '</div>').join('');
        heights = [...this.measure.children].map((c) => c.getBoundingClientRect().height);
        this.measure.textContent = '';
      }
      const cur = this.doc ? U.lineColAt(ta.value, ta.selectionStart).line : 1;
      g.innerHTML = lines.map((_, i) => '<div' + (i + 1 === cur ? ' class="cur"' : '') + (heights ? ' style="height:' + heights[i] + 'px"' : '') + '>' + (i + 1) + '</div>').join('');
      g.scrollTop = ta.scrollTop;
    },
    _markGutterLine() {
      const g = this.gutter; if (g.hidden || !this.doc) return;
      const cur = U.lineColAt(this.ta.value, this.ta.selectionStart).line;
      const old = g.querySelector('.cur'); if (old) old.classList.remove('cur');
      const el = g.children[cur - 1]; if (el) el.classList.add('cur');
    },

    setDocument(doc) {
      this._saveSelection();
      this.doc = doc;
      const ta = this.ta;
      ta.hidden = !doc;
      this.layer.hidden = !doc;
      if (!doc) { ta.value = ''; return; }
      ta.value = doc.content;
      if (!doc.history.initialized) doc.history.reset(doc.content, 0, 0);
      ta.setSelectionRange(Math.min(doc.selection.start, ta.value.length), Math.min(doc.selection.end, ta.value.length));
      ta.scrollTop = doc.scrollTop; ta.scrollLeft = doc.scrollLeft;
      this._queueLayer();
    },

    focus() { if (this.doc) this.ta.focus(); },
    getValue() { return this.ta.value; },
    getSelection() { return { start: this.ta.selectionStart, end: this.ta.selectionEnd }; },
    getSelectedText() { return this.ta.value.slice(this.ta.selectionStart, this.ta.selectionEnd); },
    setSelection(s, e) { this.ta.setSelectionRange(s, e); this._saveSelection(); },
    _saveSelection() { if (this.doc && !this.ta.hidden) this.doc.selection = { start: this.ta.selectionStart, end: this.ta.selectionEnd }; },

    _isCoalescible(type) { return type === 'insertText' || type === 'deleteContentBackward' || type === 'deleteContentForward'; },

    _onInput(e) {
      const doc = this.doc; if (!doc) return;
      const v = this.ta.value;
      this.cb.documents.setContent(doc.id, v);
      doc.history.record(v, this.ta.selectionStart, this.ta.selectionEnd, { coalesce: this._isCoalescible(e.inputType) });
      this._queueLayer();
      this.cb.onChange && this.cb.onChange(doc);
    },

    /** Modification programmatique (formatage, remplacement…) enregistrée dans l'historique. */
    applyEdit(edit) {
      const doc = this.doc; if (!doc) return;
      const ta = this.ta;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(edit.from, edit.to);
      ta.setRangeText(edit.insert, edit.from, edit.to, 'end');
      ta.setSelectionRange(edit.selStart, edit.selEnd);
      this._afterProgrammatic();
    },

    /** Remplace tout le contenu (rechargement, remplacer tout) en gardant un point d'annulation. */
    setContent(value, { keepSelection = true } = {}) {
      const doc = this.doc; if (!doc) return;
      const sel = this.getSelection();
      this.ta.value = value;
      const p = keepSelection ? Math.min(sel.start, value.length) : 0;
      this.ta.setSelectionRange(p, keepSelection ? Math.min(sel.end, value.length) : 0);
      this._afterProgrammatic();
    },

    _afterProgrammatic() {
      const doc = this.doc;
      const v = this.ta.value;
      this.cb.documents.setContent(doc.id, v);
      doc.history.record(v, this.ta.selectionStart, this.ta.selectionEnd, { coalesce: false });
      this._saveSelection();
      this._queueLayer();
      this.cb.onChange && this.cb.onChange(doc);
      this.cb.onSelection && this.cb.onSelection();
    },

    undo() { this._travel(this.doc && this.doc.history.undo()); },
    redo() { this._travel(this.doc && this.doc.history.redo()); },
    _travel(state) {
      if (!state) return;
      this.ta.value = state.value;
      this.ta.setSelectionRange(Math.min(state.selStart, state.value.length), Math.min(state.selEnd, state.value.length));
      this.cb.documents.setContent(this.doc.id, state.value);
      this._saveSelection(); this._queueLayer();
      this.cb.onChange && this.cb.onChange(this.doc);
      this.cb.onSelection && this.cb.onSelection();
    },

    _indentUnit() {
      const s = this.cb.getSettings();
      return s.insertSpaces ? ' '.repeat(s.tabSize) : '\t';
    },

    _onKeydown(e) {
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const s = this.cb.getSettings();
        const { start, end } = this.getSelection();
        const text = this.ta.value;
        let edit;
        if (e.shiftKey) edit = MW.unindent(text, start, end, s.tabSize);
        else if (start === end && s.insertSpaces) {
          const col = start - (text.lastIndexOf('\n', start - 1) + 1);
          const n = s.tabSize - (col % s.tabSize);
          edit = { from: start, to: end, insert: ' '.repeat(n), selStart: start + n, selEnd: start + n };
        } else edit = MW.indent(text, start, end, this._indentUnit());
        if (edit) this.applyEdit(edit);
      }
    },

    // ── Calque (caractères invisibles + surbrillance de la recherche) ──
    setHighlights(matches, current) { this.hl = { matches, current }; this._queueLayer(); },
    _queueLayer() {
      if (this.layerQueued) return;
      this.layerQueued = true;
      requestAnimationFrame(() => { this.layerQueued = false; this._renderLayer(); this._renderGutter(); });
    },
    _renderLayer() {
      const s = this.cb.getSettings();
      const layer = this.layer;
      const text = this.ta.value;
      const small = text.length <= LAYER_MAX;
      const inv = s.showInvisibles && small;
      const matches = small ? this.hl.matches.slice(0, 3000) : [];
      if (!this.doc || (!inv && !matches.length)) { if (layer.firstChild) layer.textContent = ''; return; }
      const esc = U.escapeHtml;
      const plain = (t) => {
        if (!inv) return esc(t);
        return esc(t).replace(/ |\t|\n/g, (c) => (c === ' ' ? '<i class="s"> </i>' : c === '\t' ? '<i class="t">\t</i>' : '<i class="n"></i>\n'));
      };
      let html = '', pos = 0;
      matches.forEach((m, i) => {
        if (m.start < pos) return;
        html += plain(text.slice(pos, m.start)) + '<mark' + (i === this.hl.current ? ' class="cur"' : '') + '>' + plain(text.slice(m.start, m.end)) + '</mark>';
        pos = m.end;
      });
      html += plain(text.slice(pos));
      if (text.endsWith('\n')) html += ' ';
      layer.innerHTML = html;
      layer.scrollTop = this.ta.scrollTop; layer.scrollLeft = this.ta.scrollLeft;
    },

    /** Fait défiler l'éditeur jusqu'à la correspondance courante (mesurée via le calque). */
    revealCurrentMatch() {
      this._renderLayer();
      const mark = this.layer.querySelector('mark.cur');
      if (!mark) return;
      const ta = this.ta;
      const top = mark.offsetTop, h = mark.offsetHeight;
      if (top < ta.scrollTop + 20 || top + h > ta.scrollTop + ta.clientHeight - 40) ta.scrollTop = Math.max(0, top - ta.clientHeight / 2);
      const left = mark.offsetLeft;
      if (left < ta.scrollLeft || left > ta.scrollLeft + ta.clientWidth - 60) ta.scrollLeft = Math.max(0, left - ta.clientWidth / 2);
    },
  };

  MW.editor = E;
})();
