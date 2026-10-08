(function () {
  const MW = window.MW; const { h } = MW;
  const S = {
    cells: {},
    init() {
      const root = document.getElementById('statusbar');
      const c = this.cells;
      c.pos = h('span', { class: 'sb-cell' });
      c.lines = h('span', { class: 'sb-cell' });
      c.words = h('span', { class: 'sb-cell' });
      c.chars = h('span', { class: 'sb-cell' });
      c.save = h('span', { class: 'sb-cell', 'aria-live': 'polite' });
      c.enc = h('button', { class: 'sb-cell', 'aria-label': 'Changer l’encodage', onClick: (e) => MW.app.encodingMenu(e) });
      c.eol = h('button', { class: 'sb-cell', 'aria-label': 'Changer les fins de ligne', onClick: () => MW.app.toggleEol() });
      c.type = h('span', { class: 'sb-cell' });
      c.zoom = h('button', { class: 'sb-cell', 'aria-label': 'Réinitialiser le zoom', 'data-tip': 'Cliquer pour revenir à 100 %', 'data-tip-side': 'top', onClick: () => MW.commands.execute('view.zoomReset') });
      root.append(c.pos, c.lines, c.words, c.chars, h('span', { class: 'sb-spacer' }), c.save, c.enc, c.eol, c.type, c.zoom);
    },
    update() {
      const c = this.cells, doc = MW.editor.doc, s = MW.Store.settings;
      c.zoom.textContent = s.zoom + ' %';
      if (!doc) { for (const k of ['pos', 'lines', 'words', 'chars', 'save', 'enc', 'eol', 'type']) c[k].textContent = ''; return; }
      const text = MW.editor.getValue();
      const sel = MW.editor.getSelection();
      const lc = MW.lineColAt(text, sel.start);
      c.pos.textContent = 'Ln ' + lc.line + ', Col ' + lc.col + (sel.end > sel.start ? ' (' + (sel.end - sel.start) + ' sél.)' : '');
      const nl = MW.countLines(text);
      c.lines.textContent = nl.toLocaleString('fr-FR') + (nl > 1 ? ' lignes' : ' ligne');
      const w = MW.countWords(text);
      c.words.textContent = w.toLocaleString('fr-FR') + (w > 1 ? ' mots' : ' mot');
      c.chars.textContent = text.length.toLocaleString('fr-FR') + (text.length > 1 ? ' caractères' : ' caractère');
      const enc = MW.ENCODINGS.find((x) => x.value === doc.encoding);
      c.enc.textContent = enc ? enc.label : doc.encoding;
      c.eol.textContent = doc.eol;
      c.type.textContent = MW.typeForExtension(doc.extension).label;
      let txt = 'Sauvegardé', cls = 'st-saved';
      if (doc.saving) { txt = 'Sauvegarde…'; cls = 'st-dirty'; }
      else if (doc.saveError) { txt = 'Erreur de sauvegarde'; cls = 'st-error'; }
      else if (!doc.path) { txt = 'Non enregistré'; cls = 'st-dirty'; }
      else if (doc.isDirty) { txt = 'Modifié'; cls = 'st-dirty'; }
      c.save.textContent = txt; c.save.className = 'sb-cell ' + cls;
    },
  };
  MW.statusbar = S;
})();
