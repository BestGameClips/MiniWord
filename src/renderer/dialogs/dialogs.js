(function () {
  const MW = window.MW; const { h } = MW;
  let openCount = 0;

  /**
   * Boîte de dialogue modale accessible (focus piégé, Échap, restauration du focus).
   * opts: { title, body (Node|string), buttons:[{label,value,variant,default}], dismissValue, className, top, onClose }
   * Renvoie { el, close(value), promise }.
   */
  function show(opts) {
    const prevFocus = document.activeElement;
    const titleId = 'dlg-' + Math.random().toString(36).slice(2, 8);
    let done = false, resolve;
    const promise = new Promise((r) => { resolve = r; });
    const body = typeof opts.body === 'string' ? h('p', null, opts.body) : opts.body;
    const footer = h('div', { class: 'modal-foot' });
    const modal = h('div', { class: 'modal ' + (opts.className || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': opts.title ? titleId : null },
      opts.title ? h('div', { class: 'modal-head', id: titleId }, opts.title) : null,
      opts.raw ? null : h('div', { class: 'modal-body' }, body), opts.raw ? body : null,
      opts.buttons && opts.buttons.length ? footer : null);
    const backdrop = h('div', { class: 'modal-backdrop' + (opts.top ? ' top' : '') }, modal);

    function close(value) {
      if (done) return;
      done = true;
      backdrop.remove();
      openCount--; if (!openCount) document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
      if (opts.onClose) opts.onClose(value);
      resolve(value);
    }
    for (const b of opts.buttons || []) {
      footer.append(h('button', { class: 'btn ' + (b.variant || ''), 'data-default': b.default ? '1' : null, onClick: () => close(b.value) }, b.label));
    }
    function onKey(e) {
      if (backdrop !== [...document.querySelectorAll('.modal-backdrop')].pop()) return;
      if (e.key === 'Escape' && opts.dismissValue !== undefined) { e.preventDefault(); e.stopPropagation(); close(opts.dismissValue); return; }
      if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
        const d = footer.querySelector('[data-default]');
        if (d && !opts.noEnter) { e.preventDefault(); d.click(); }
      }
      if (e.key === 'Tab') {
        const f = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    if (opts.dismissValue !== undefined) backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(opts.dismissValue); });
    document.getElementById('overlays').append(backdrop);
    openCount++; document.body.classList.add('modal-open');
    const focusEl = modal.querySelector('[data-autofocus]') || footer.querySelector('[data-default]') || modal.querySelector('input, button');
    if (focusEl) focusEl.focus();
    return { el: modal, close, promise };
  }

  MW.dialogs = {
    show,
    isOpen: () => openCount > 0,
    /** buttons: [{label, value, variant, default}] ; Échap → null */
    choose(title, message, buttons) { return show({ title, body: message, buttons, dismissValue: null }).promise; },
    confirm(title, message, { ok = 'OK', cancel = 'Annuler', danger = false } = {}) {
      return show({ title, body: message, dismissValue: false, buttons: [{ label: cancel, value: false }, { label: ok, value: true, variant: danger ? 'danger' : 'primary', default: true }] }).promise;
    },
    alert(title, message) { return show({ title, body: message, dismissValue: true, buttons: [{ label: 'OK', value: true, variant: 'primary', default: true }] }).promise; },
    prompt(title, label, value) {
      const input = h('input', { class: 'field-input', value: value || '', 'data-autofocus': '1', 'aria-label': label });
      const body = h('div', null, h('p', { class: 'dim' }, label), input);
      const d = show({ title, body, dismissValue: null, buttons: [{ label: 'Annuler', value: null }, { label: 'OK', value: 'ok', variant: 'primary', default: true }] });
      return d.promise.then((v) => (v === 'ok' ? input.value : null));
    },
  };
})();
