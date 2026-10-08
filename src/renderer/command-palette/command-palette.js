(function () {
  const MW = window.MW; const { h, icon } = MW;
  let active = null;

  function open() {
    if (active) { active.close(); return; }
    let results = [], sel = 0;
    const input = h('input', { placeholder: 'Rechercher une commande…', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-label': 'Rechercher une commande', 'data-autofocus': '1', spellcheck: 'false' });
    const list = h('div', { class: 'palette-list', id: 'palette-list', role: 'listbox' });
    const body = h('div', { class: 'palette' }, h('div', { class: 'palette-input' }, icon('search', 18), input), list);

    function render() {
      MW.clear(list);
      if (!results.length) { list.append(h('div', { class: 'palette-empty' }, 'Aucune commande trouvée')); return; }
      results.forEach((c, i) => {
        const acc = MW.shortcuts.getBinding(c.id);
        const row = h('button', { class: 'palette-item', role: 'option', id: 'pal-' + i, 'aria-selected': String(i === sel), tabindex: '-1',
          onMouseenter: () => { sel = i; mark(); }, onClick: () => run(c) },
          h('span', { class: 'cat' }, c.category), h('span', { class: 'ttl' }, c.title), acc ? h('kbd', null, MW.ShortcutManager.format(acc, MW.isMac)) : null);
        list.append(row);
      });
      mark();
    }
    function mark() {
      [...list.children].forEach((el, i) => el.setAttribute && el.setAttribute('aria-selected', String(i === sel)));
      const el = list.children[sel]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', 'pal-' + sel);
    }
    function run(c) { dlg.close(); setTimeout(() => MW.commands.execute(c.id).catch((e) => MW.notify.error(e.message || 'La commande a échoué.')), 0); }
    function update() { results = MW.commands.search(input.value).slice(0, 60); sel = 0; render(); }

    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[sel]) run(results[sel]); }
    });
    const dlg = MW.dialogs.show({ body, raw: true, top: true, dismissValue: null, noEnter: true, onClose: () => { active = null; } });
    active = dlg;
    update();
  }
  MW.palette = { open, isOpen: () => !!active };
})();
