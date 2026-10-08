(function () {
  const MW = window.MW; const { h } = MW;
  let current = null;

  function hide() { if (current) { current.cleanup(); current = null; } }

  /** items: [{label, shortcut, run, disabled, checked, danger}] | {separator:true} */
  function show(x, y, items) {
    hide();
    const prev = document.activeElement;
    const menu = h('div', { class: 'ctx-menu', role: 'menu' });
    const buttons = [];
    for (const it of items) {
      if (it.separator) { menu.append(h('div', { class: 'ctx-sep', role: 'separator' })); continue; }
      const b = h('button', { class: 'ctx-item' + (it.danger ? ' danger' : ''), role: 'menuitem', disabled: it.disabled ? true : null, tabindex: '-1',
        onClick: () => { hide(); if (prev && prev.focus && document.contains(prev)) prev.focus(); Promise.resolve(it.run && it.run()).catch((e) => console.error(e)); } },
        h('span', { class: 'ck' }, it.checked ? '✓' : ''), h('span', { class: 'lbl' }, it.label), it.shortcut ? h('span', { class: 'sc' }, it.shortcut) : null);
      if (!it.disabled) buttons.push(b);
      menu.append(b);
    }
    if (!buttons.length) return;
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
    let idx = -1;
    const focusAt = (i) => { idx = (i + buttons.length) % buttons.length; buttons.forEach((b, j) => b.classList.toggle('focus', j === idx)); buttons[idx].focus(); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); if (prev && prev.focus) prev.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); focusAt(idx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); focusAt(idx < 0 ? -1 : idx - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
      else if (e.key === 'End') { e.preventDefault(); focusAt(-1); }
      else if (e.key === 'Tab') { e.preventDefault(); }
    };
    const onDown = (e) => { if (!menu.contains(e.target)) hide(); };
    const onBlur = () => hide();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    current = { cleanup() { menu.remove(); document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown, true); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', onBlur); } };
    if (window.__ctxKeyboard) focusAt(0);
  }

  MW.contextMenu = { show, hide };
})();
