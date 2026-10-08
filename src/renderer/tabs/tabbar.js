(function () {
  const MW = window.MW; const { h, icon } = MW;
  const DRAG_TYPE = 'application/x-miniword-tab';

  const T = {
    root: null,
    init() {
      this.root = document.getElementById('tabbar');
      this.root.addEventListener('wheel', (e) => { if (e.deltaY && !e.shiftKey) { this.root.scrollLeft += e.deltaY; } }, { passive: true });
      this.root.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault(); });
      const rerender = () => this.render();
      MW.tabs.on('change', rerender);
      MW.documents.on('dirty', rerender); MW.documents.on('meta', rerender);
    },

    render() {
      const { tabs, documents } = MW;
      const root = this.root;
      MW.clear(root);
      const docs = tabs.order.map((id) => documents.get(id)).filter(Boolean);
      const nameCount = {};
      docs.forEach((d) => { nameCount[d.name] = (nameCount[d.name] || 0) + 1; });

      docs.forEach((doc, i) => {
        const active = doc.id === tabs.activeId, pinned = tabs.isPinned(doc.id);
        const hint = nameCount[doc.name] > 1 && doc.path ? MW.parentFolderName(doc.path) : '';
        const state = h('span', { class: 't-state', 'data-tip': pinned ? 'Désépingler' : 'Fermer (Ctrl+W)', onClick: (e) => { e.stopPropagation(); if (pinned) tabs.togglePin(doc.id); else MW.fileActions.closeTabs([doc.id]); } },
          h('span', { class: 't-dot' }), pinned ? h('span', { class: 't-pin' }, icon('pin', 13)) : h('span', { class: 't-x' }, icon('x', 13)));
        state.setAttribute('role', 'button'); state.setAttribute('aria-label', pinned ? 'Désépingler ' + doc.name : 'Fermer ' + doc.name);
        const el = h('div', {
          class: 'tab' + (doc.isDirty ? ' dirty' : '') + (pinned ? ' pinned' : ''), role: 'tab', 'aria-selected': String(active), tabindex: active ? '0' : '-1',
          draggable: 'true', dataset: { id: doc.id }, title: doc.path || doc.name,
          onClick: () => tabs.activate(doc.id),
          onAuxclick: (e) => { if (e.button === 1) { e.preventDefault(); if (!pinned) MW.fileActions.closeTabs([doc.id]); } },
          onContextmenu: (e) => { e.preventDefault(); MW.fileActions.tabMenu(e.clientX, e.clientY, doc.id); },
          onKeydown: (e) => this._key(e, doc, i),
          onDragstart: (e) => { e.dataTransfer.setData(DRAG_TYPE, doc.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); },
          onDragend: () => { el.classList.remove('dragging'); this._clearDrop(); },
          onDragover: (e) => { if (!e.dataTransfer.types.includes(DRAG_TYPE)) return; e.preventDefault(); const r = el.getBoundingClientRect(); this._clearDrop(); el.classList.add(e.clientX < r.left + r.width / 2 ? 'drag-over-left' : 'drag-over-right'); },
          onDrop: (e) => {
            const id = e.dataTransfer.getData(DRAG_TYPE); if (!id) return;
            e.preventDefault(); e.stopPropagation();
            const r = el.getBoundingClientRect(); const before = e.clientX < r.left + r.width / 2;
            const from = tabs.indexOf(id); let to = tabs.indexOf(doc.id) + (before ? 0 : 1); if (from < to) to--;
            this._clearDrop(); tabs.move(id, to);
          },
        }, h('span', { class: 't-ext' }, MW.typeForExtension(doc.extension).label), h('span', { class: 't-name' }, doc.name, hint ? h('span', { class: 't-hint' }, hint) : null), state);
        root.append(el);
        if (active) requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      });
      root.append(h('button', { class: 'icon-btn tab-add', 'aria-label': 'Nouveau document', 'data-tip': 'Nouveau (Ctrl+N)', onClick: () => MW.commands.execute('file.new') }, icon('plus', 16)));
    },

    _clearDrop() { this.root.querySelectorAll('.drag-over-left, .drag-over-right').forEach((x) => x.classList.remove('drag-over-left', 'drag-over-right')); },

    _key(e, doc, i) {
      const ids = MW.tabs.order;
      const focusTab = (id) => { MW.tabs.activate(id); requestAnimationFrame(() => { const n = this.root.querySelector('.tab[data-id="' + id + '"]'); if (n) n.focus(); }); };
      if (e.key === 'ArrowRight') { e.preventDefault(); focusTab(ids[(i + 1) % ids.length]); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); focusTab(ids[(i - 1 + ids.length) % ids.length]); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); MW.editor.focus(); }
      else if (e.key === 'Delete') { e.preventDefault(); MW.fileActions.closeTabs([doc.id]); }
    },
  };
  MW.tabbar = T;
})();
